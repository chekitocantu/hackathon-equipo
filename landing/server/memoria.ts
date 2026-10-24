// Memoria del Traductor en InsForge: guarda lo que se dice en cada llamada y, en vivo,
// recupera lo que el cliente ya dijo en llamadas anteriores y qué compraron clientes parecidos.
// Corre solo en el servidor con la API key de administrador; el navegador nunca habla con InsForge.
// Tablas: migrations/20261024192202_memoria-de-clientes.sql

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminClient } from '@insforge/sdk';
import { claveDePregunta, type Ayuda, type PreguntaLlamada } from './ayuda.ts';

export interface ConfigInsforge {
  url?: string;
  apiKey?: string;
}

export interface Segmento {
  quien: string;
  texto: string;
}

export interface AnalisisGuardable {
  empresa: string | null;
  industria: string | null;
  productos: { sku: string; estado: string; cantidad?: number }[];
  datos: { etiqueta: string | null; valor: string | null }[];
}

export interface Recuerdo {
  /** Lo que el cliente ya dijo en llamadas anteriores. */
  yaSabemos: { etiqueta: string; valor: string; fecha: string }[];
  /** Hasta 3 clientes de la misma industria o con productos en común, con lo que se les ofreció. */
  similares: { empresa: string; industria: string | null; comun: string; productos: string[]; it: string | null }[];
}

/** Lee INSFORGE_URL/INSFORGE_API_KEY de .env.local y, si faltan, el proyecto enlazado con `insforge link`. */
export function configInsforge(env: Record<string, string>, raiz: string): ConfigInsforge {
  if (env.INSFORGE_URL && env.INSFORGE_API_KEY) return { url: env.INSFORGE_URL, apiKey: env.INSFORGE_API_KEY };
  const enlazado = resolve(raiz, '../.insforge/project.json');
  if (!existsSync(enlazado)) return {};
  const proyecto = JSON.parse(readFileSync(enlazado, 'utf8')) as { oss_host?: string; api_key?: string };
  return { url: proyecto.oss_host, apiKey: proyecto.api_key };
}

export const claveDeEmpresa = (empresa: string) =>
  empresa
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function crearMemoria(config: ConfigInsforge, nombreDeSku: (sku: string) => string) {
  if (!config.url || !config.apiKey) return null;
  const db = createAdminClient({ baseUrl: config.url, apiKey: config.apiKey }).database;

  async function cliente(empresa: string, industria: string | null) {
    const clave = claveDeEmpresa(empresa);
    const { data, error } = await db.from('clientes').select('id, industria').eq('clave', clave).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      if (industria && !data.industria) await db.from('clientes').update({ industria, actualizado: new Date().toISOString() }).eq('id', data.id);
      return data.id as string;
    }
    const nuevo = await db.from('clientes').insert([{ clave, empresa, industria }]).select('id').single();
    if (nuevo.error) throw new Error(nuevo.error.message);
    return nuevo.data.id as string;
  }

  /** Guarda la llamada, las frases nuevas y lo que detectó el agente. Devuelve el id del cliente, si ya se sabe quién es. */
  async function guardar(llamada: { id: string; origen: string; codigo?: string }, transcripcion: Segmento[], analisis: AnalisisGuardable) {
    const ahora = new Date().toISOString();
    const existente = await db.from('llamadas').select('id, cliente_id').eq('id', llamada.id).maybeSingle();
    if (existente.error) throw new Error(existente.error.message);
    let clienteId = (existente.data?.cliente_id as string | null) ?? null;
    if (!clienteId && analisis.empresa) clienteId = await cliente(analisis.empresa, analisis.industria);

    if (!existente.data) {
      const r = await db.from('llamadas').insert([{ id: llamada.id, origen: llamada.origen, codigo: llamada.codigo ?? null, cliente_id: clienteId }]);
      if (r.error) throw new Error(r.error.message);
    } else {
      await db.from('llamadas').update({ cliente_id: clienteId, actualizado: ahora }).eq('id', llamada.id);
    }

    // Solo las frases que no se habían guardado; el orden es la posición en la conversación.
    const guardadas = await db.from('segmentos').select('orden').eq('llamada_id', llamada.id).order('orden', { ascending: false }).limit(1);
    const desde = guardadas.data?.length ? (guardadas.data[0].orden as number) + 1 : 0;
    const nuevas = transcripcion.slice(desde).map((s, i) => ({ llamada_id: llamada.id, orden: desde + i, quien: s.quien, texto: s.texto }));
    if (nuevas.length) {
      const r = await db.from('segmentos').insert(nuevas);
      if (r.error) throw new Error(r.error.message);
    }

    if (!clienteId) return null;
    for (const d of analisis.datos) {
      if (!d.etiqueta || !d.valor) continue;
      const fila = { cliente_id: clienteId, llamada_id: llamada.id, etiqueta: d.etiqueta, valor: d.valor, actualizado: ahora };
      const hay = await db.from('datos_cliente').select('id, valor').eq('cliente_id', clienteId).eq('etiqueta', d.etiqueta).maybeSingle();
      // Si el cliente repite lo que ya había dicho, el dato se queda con su llamada original; si no, dejaría
      // de aparecer en "ya lo sabemos" (recordar() salta los datos de la llamada en curso).
      if (hay.data?.valor === d.valor) continue;
      if (hay.data) await db.from('datos_cliente').update(fila).eq('id', hay.data.id);
      else await db.from('datos_cliente').insert([fila]);
    }
    for (const p of analisis.productos) {
      const fila = { cliente_id: clienteId, llamada_id: llamada.id, sku: p.sku, estado: p.estado, cantidad: p.cantidad ?? null, actualizado: ahora };
      const hay = await db.from('productos_cliente').select('id').eq('cliente_id', clienteId).eq('sku', p.sku).maybeSingle();
      if (hay.data) await db.from('productos_cliente').update(fila).eq('id', hay.data.id);
      else await db.from('productos_cliente').insert([fila]);
    }
    return clienteId;
  }

  /** Lo que ya se sabe de este cliente por otras llamadas, y clientes parecidos por industria o productos. */
  async function recordar(llamadaId: string, clienteId: string | null, industria: string | null, skus: string[]): Promise<Recuerdo> {
    const yaSabemos: Recuerdo['yaSabemos'] = [];
    if (clienteId) {
      const { data } = await db
        .from('datos_cliente')
        .select('etiqueta, valor, actualizado, llamada_id')
        .eq('cliente_id', clienteId)
        .order('actualizado', { ascending: false })
        .limit(12);
      for (const d of data ?? []) {
        if (d.llamada_id === llamadaId) continue;
        yaSabemos.push({ etiqueta: d.etiqueta, valor: d.valor, fecha: String(d.actualizado).slice(0, 10) });
      }
    }

    const candidatos = new Map<string, string>();
    if (skus.length) {
      const { data } = await db.from('productos_cliente').select('cliente_id, sku').in('sku', skus).limit(40);
      for (const p of data ?? []) {
        if (p.cliente_id !== clienteId && !candidatos.has(p.cliente_id)) candidatos.set(p.cliente_id, `También pidió ${nombreDeSku(p.sku)}`);
      }
    }
    if (industria) {
      const { data } = await db.from('clientes').select('id').ilike('industria', industria).limit(10);
      for (const c of data ?? []) if (c.id !== clienteId && !candidatos.has(c.id)) candidatos.set(c.id, `Misma industria: ${industria}`);
    }
    const ids = [...candidatos.keys()].slice(0, 3);
    if (!ids.length) return { yaSabemos, similares: [] };

    const [clientes, productos, llamadas] = await Promise.all([
      db.from('clientes').select('id, empresa, industria').in('id', ids),
      db.from('productos_cliente').select('cliente_id, sku').in('cliente_id', ids).limit(40),
      db.from('llamadas').select('id, cliente_id').in('cliente_id', ids).limit(30),
    ]);
    // Si a ese cliente le entró IT y por qué: le dice al vendedor qué esperar con un caso parecido.
    const deCliente = new Map((llamadas.data ?? []).map((l) => [l.id as string, l.cliente_id as string]));
    const ayudas = deCliente.size
      ? await db.from('ayuda_it').select('llamada_id, tipo_caso, nivel, entra, actualizado').in('llamada_id', [...deCliente.keys()]).order('actualizado', { ascending: false }).limit(30)
      : { data: [] };
    const itDe = (id: string) => {
      const a = (ayudas.data ?? []).find((x) => deCliente.get(x.llamada_id) === id);
      if (!a) return null;
      if (a.nivel === 'no') return `${a.tipo_caso}: sin IT`;
      const temas = (a.entra as { tema: string }[]).map((e) => e.tema).slice(0, 2).join(', ');
      return `${a.tipo_caso}: entró IT por ${temas}`;
    };
    const similares = ids
      .map((id) => {
        const c = (clientes.data ?? []).find((x) => x.id === id);
        if (!c) return null;
        const suyos = (productos.data ?? []).filter((p) => p.cliente_id === id).map((p) => nombreDeSku(p.sku));
        return {
          empresa: c.empresa as string,
          industria: (c.industria as string | null) ?? null,
          comun: candidatos.get(id)!,
          productos: suyos.slice(0, 4),
          it: itDe(id),
        };
      })
      .filter((s): s is Recuerdo['similares'][number] => s !== null);
    return { yaSabemos, similares };
  }

  /** Para el prompt del agente: lo que el cliente ya contó antes, para no volver a preguntarlo. */
  async function previo(llamadaId: string) {
    const { data } = await db.from('llamadas').select('cliente_id').eq('id', llamadaId).maybeSingle();
    if (!data?.cliente_id) return [];
    return (await recordar(llamadaId, data.cliente_id as string, null, [])).yaSabemos;
  }

  /** Guarda las preguntas nuevas de la llamada y devuelve todas, para que el conteo técnico abarque toda la llamada. */
  async function preguntas(llamadaId: string, nuevas: PreguntaLlamada[]): Promise<PreguntaLlamada[]> {
    const { data } = await db.from('preguntas_llamada').select('origen, texto, clave, tecnica, termino').eq('llamada_id', llamadaId).limit(200);
    const vistas = new Set((data ?? []).map((p) => p.clave as string));
    const filas = nuevas
      .map((p) => ({ llamada_id: llamadaId, origen: p.origen, texto: p.texto, clave: claveDePregunta(p.texto), tecnica: p.tecnica, termino: p.termino }))
      .filter((p) => p.clave && !vistas.has(p.clave) && vistas.add(p.clave));
    if (filas.length) {
      const r = await db.from('preguntas_llamada').insert(filas);
      if (r.error) throw new Error(r.error.message);
    }
    return [...(data ?? []), ...filas].map((p) => ({ origen: p.origen, texto: p.texto, tecnica: p.tecnica, termino: p.termino }));
  }

  async function guardarAyuda(llamadaId: string, a: Ayuda) {
    const fila = { tipo_caso: a.tipoCaso, nivel: a.nivel, tecnicas: a.tecnicas, total: a.total, entra: a.entra, no_entra: a.noEntra, actualizado: new Date().toISOString() };
    const hay = await db.from('ayuda_it').select('llamada_id').eq('llamada_id', llamadaId).maybeSingle();
    const r = hay.data
      ? await db.from('ayuda_it').update(fila).eq('llamada_id', llamadaId)
      : await db.from('ayuda_it').insert([{ llamada_id: llamadaId, ...fila }]);
    if (r.error) throw new Error(r.error.message);
  }

  return { guardar, recordar, previo, cliente, preguntas, guardarAyuda };
}

export type Memoria = NonNullable<ReturnType<typeof crearMemoria>>;
