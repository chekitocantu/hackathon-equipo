// API local para "Enlaza tu llamada". Corre dentro del servidor de Vite para que las llaves
// (OpenRouter y Vexa) se queden en la máquina y nunca lleguen al navegador.
//   POST /api/llamada/iniciar    → manda el bot del notetaker (Vexa) a la reunión de Meet
//   GET  /api/llamada/segmentos  → estado del bot y frases transcritas hasta ahora
//   POST /api/llamada/terminar   → saca al bot de la reunión
//   POST /api/transcribir        → respaldo sin bot: audio webm del navegador → texto (Whisper vía OpenRouter)
//   POST /api/analizar           → transcripción → productos, datos, reglas y siguiente pregunta (Claude vía OpenRouter);
//                                  si InsForge está configurado, guarda la llamada y devuelve lo que ya se sabía del cliente
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { codigoDeMeet, enviarBot, estadoBot, leerSegmentos, sacarBot, type ConfigVexa } from './vexa.ts';
import { crearMemoria, type ConfigInsforge, type Memoria, type Recuerdo } from './memoria.ts';

const OPENROUTER = 'https://openrouter.ai/api/v1';

export interface ConfigApi {
  apiKey?: string;
  modeloTranscripcion: string;
  modeloAgente: string;
  vexa: ConfigVexa;
  /** Sin URL ni key, la llamada funciona igual pero no se guarda ni se recuerda nada. */
  insforge: ConfigInsforge;
  /** Carpeta del proyecto `landing`; el catálogo está a un lado. */
  raiz: string;
}

interface Producto {
  sku: string;
  familia: string;
  nombre: string;
  tipo: string;
  unidad_cobro: string;
  senal_del_cliente: string;
  preguntas_clave: string[];
  requiere_alguno_de: string[];
  se_recomienda_con: string[];
  cuando_entra_arquitecto: string | null;
}

interface Catalogo {
  familias: { id: string; nombre: string; problemas_que_resuelve: string }[];
  productos: Producto[];
  paquetes: { id: string; nombre: string; productos: string[] }[];
  reglas_escalamiento: { id: string; cuando_entra_un_arquitecto: string }[];
}

const ESTADOS = new Set(['incluido', 'pendiente', 'arquitecto', 'sugerido']);

// Frases que Whisper inventa cuando solo oye ruido o silencio.
const ALUCINACIONES = [/subt[ií]tulos/i, /amara\.org/i, /gracias por ver/i, /suscr[ií]be/i, /^[\s.,¡!¿?-]*$/];

export function crearApi(config: ConfigApi) {
  const catalogo = JSON.parse(readFileSync(resolve(config.raiz, '../catalogo-simulado/catalogo-simulado.json'), 'utf8')) as Catalogo;
  const sistema = promptDelAgente(catalogo);
  const nombres = new Map(catalogo.productos.map((p) => [p.sku, p.nombre]));
  const memoria = crearMemoria(config.insforge, (sku) => nombres.get(sku) ?? sku);

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next();
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/llamada/')) {
        if (!config.vexa.apiKey) {
          return responder(res, 500, { error: 'Falta VEXA_API_KEY en landing/.env.local. Agrégala y reinicia npm run dev.' });
        }
        if (req.method === 'POST' && url.pathname === '/api/llamada/iniciar') {
          const { link } = JSON.parse((await leerCuerpo(req)).toString('utf8')) as { link: string };
          const codigo = codigoDeMeet(link ?? '');
          if (!codigo) return responder(res, 400, { error: 'Ese link no parece de Google Meet. Debe verse como meet.google.com/abc-defg-hij.' });
          await enviarBot(config.vexa, codigo);
          return responder(res, 200, { codigo });
        }
        if (req.method === 'GET' && url.pathname === '/api/llamada/segmentos') {
          const codigo = url.searchParams.get('codigo') ?? '';
          const [estado, segmentos] = await Promise.all([
            estadoBot(config.vexa, codigo),
            // Mientras el bot espera en la sala, Vexa puede no tener transcripción todavía.
            leerSegmentos(config.vexa, codigo, url.searchParams.get('vendedor') ?? '').catch(() => []),
          ]);
          return responder(res, 200, { estado, segmentos });
        }
        if (req.method === 'POST' && url.pathname === '/api/llamada/terminar') {
          const { codigo } = JSON.parse((await leerCuerpo(req)).toString('utf8')) as { codigo: string };
          await sacarBot(config.vexa, codigo);
          return responder(res, 200, { ok: true });
        }
        return responder(res, 404, { error: 'Ruta no encontrada' });
      }

      if (!config.apiKey) {
        return responder(res, 500, { error: 'Falta OPENROUTER_API_KEY en landing/.env.local. Agrégala y reinicia npm run dev.' });
      }
      if (req.method === 'POST' && req.url.startsWith('/api/transcribir')) {
        const audio = await leerCuerpo(req);
        return responder(res, 200, { texto: await transcribir(config, audio) });
      }
      if (req.method === 'POST' && req.url.startsWith('/api/analizar')) {
        const { transcripcion, llamada } = JSON.parse((await leerCuerpo(req)).toString('utf8')) as {
          transcripcion: { quien: string; texto: string }[];
          llamada?: { id: string; origen: string; codigo?: string };
        };
        if (!memoria || !llamada?.id) return responder(res, 200, { ...(await analizar(config, sistema, catalogo, transcripcion, [])), memoria: null });
        return responder(res, 200, await analizarConMemoria(config, sistema, catalogo, memoria, llamada, transcripcion));
      }
      responder(res, 404, { error: 'Ruta no encontrada' });
    } catch (e) {
      responder(res, 502, { error: e instanceof Error ? e.message : String(e) });
    }
  };
}

async function transcribir(config: ConfigApi, audio: Buffer) {
  // Menos de ~2 KB de webm es medio segundo o menos: no vale la pena mandarlo.
  if (audio.length < 2000) return '';
  const respuesta = await llamar(config, '/audio/transcriptions', {
    model: config.modeloTranscripcion,
    input_audio: { data: audio.toString('base64'), format: 'webm' },
    language: 'es',
  });
  const texto = String(respuesta.text ?? '').trim();
  return texto.length < 80 && ALUCINACIONES.some((re) => re.test(texto)) ? '' : texto;
}

/**
 * El análisis normal, más la memoria: antes de llamar al modelo se le pasa lo que el cliente ya contó en otras llamadas;
 * después se guarda lo nuevo y se buscan clientes parecidos. Si InsForge falla, la llamada sigue sin memoria.
 */
async function analizarConMemoria(
  config: ConfigApi,
  sistema: string,
  catalogo: Catalogo,
  memoria: Memoria,
  llamada: { id: string; origen: string; codigo?: string },
  transcripcion: { quien: string; texto: string }[],
) {
  const previo = await memoria.previo(llamada.id).catch(() => []);
  const resultado = await analizar(config, sistema, catalogo, transcripcion, previo);
  let recuerdo: Recuerdo | null = null;
  try {
    const clienteId = await memoria.guardar(llamada, transcripcion, resultado);
    recuerdo = await memoria.recordar(llamada.id, clienteId, resultado.industria, resultado.productos.map((p) => p.sku));
  } catch (e) {
    console.warn('[memoria] InsForge no respondió:', e instanceof Error ? e.message : e);
  }
  return { ...resultado, memoria: recuerdo };
}

async function analizar(
  config: ConfigApi,
  sistema: string,
  catalogo: Catalogo,
  transcripcion: { quien: string; texto: string }[],
  previo: Recuerdo['yaSabemos'],
) {
  const conversacion = transcripcion
    .slice(-150)
    .map((t) => `${t.quien}: ${t.texto}`)
    .join('\n');
  const antes = previo.length
    ? `Esto ya lo dijo el cliente en llamadas anteriores (no lo vuelvas a preguntar; úsalo si sigue aplicando):\n${previo
        .map((d) => `- ${d.etiqueta}: ${d.valor} (${d.fecha})`)
        .join('\n')}\n\n`
    : '';
  const respuesta = await llamar(config, '/chat/completions', {
    model: config.modeloAgente,
    temperature: 0.2,
    max_tokens: 1500,
    messages: [
      // El catálogo es igual en cada llamada; se marca para caché y así cada turno responde más rápido.
      { role: 'system', content: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }] },
      { role: 'user', content: `${antes}Transcripción de la videollamada hasta ahora:\n\n${conversacion}\n\nDevuelve solo el JSON.` },
    ],
  });
  const texto = String(respuesta.choices?.[0]?.message?.content ?? '');
  const json = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  return validar(JSON.parse(json), catalogo);
}

/** Lo que diga el modelo pasa por aquí: solo sobreviven productos y reglas que existen en el catálogo. */
function validar(crudo: Record<string, unknown>, catalogo: Catalogo) {
  const productos = new Map(catalogo.productos.map((p) => [p.sku, p]));
  const reglas = new Set(catalogo.reglas_escalamiento.map((r) => r.id));
  const lista = (x: unknown) => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);
  const texto = (x: unknown, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);

  const vistos = new Set<string>();
  let sugeridos = 0;
  const productosValidos = lista(crudo.productos)
    .filter((p) => typeof p.sku === 'string' && productos.has(p.sku) && ESTADOS.has(String(p.estado)))
    .filter((p) => !vistos.has(p.sku as string) && vistos.add(p.sku as string))
    .map((p) => {
      const delCatalogo = productos.get(p.sku as string)!;
      let estado = String(p.estado);
      if (delCatalogo.tipo === 'a la medida' && estado !== 'sugerido') estado = 'arquitecto';
      const cantidad = Number(p.cantidad);
      return {
        sku: delCatalogo.sku,
        estado,
        cantidad: Number.isFinite(cantidad) && cantidad > 0 ? Math.round(cantidad) : undefined,
        nota: texto(p.nota, 32) ?? undefined,
      };
    })
    .filter((p) => p.estado !== 'sugerido' || ++sugeridos <= 2)
    .slice(0, 8);

  const pregunta = crudo.pregunta as Record<string, unknown> | null;
  return {
    empresa: texto(crudo.empresa, 60),
    industria: texto(crudo.industria, 40),
    productos: productosValidos,
    reglas: (Array.isArray(crudo.reglas) ? (crudo.reglas as unknown[]) : [])
      .map(String)
      .filter((id, i, todos) => reglas.has(id) && todos.indexOf(id) === i),
    datos: lista(crudo.datos)
      .slice(0, 5)
      .map((d) => ({ etiqueta: texto(d.dato ?? d.etiqueta, 60), valor: texto(d.valor, 70) }))
      .filter((d) => d.etiqueta),
    pregunta:
      pregunta && texto(pregunta.texto, 220)
        ? { texto: texto(pregunta.texto, 220), motivo: texto(pregunta.motivo, 120) ?? '', fuente: texto(pregunta.fuente, 80) ?? 'Agente' }
        : null,
  };
}

function promptDelAgente(catalogo: Catalogo) {
  const familias = catalogo.familias.map((f) => `- ${f.id} = ${f.nombre}. Resuelve: ${f.problemas_que_resuelve}`).join('\n');
  const productos = catalogo.productos
    .map((p) =>
      [
        p.sku,
        p.familia,
        p.nombre,
        p.tipo,
        `cobro: ${p.unidad_cobro}`,
        `señal del cliente: "${p.senal_del_cliente}"`,
        `preguntas clave: ${p.preguntas_clave.join(' / ')}`,
        p.requiere_alguno_de.length ? `requiere alguno de: ${p.requiere_alguno_de.join(', ')}` : '',
        p.se_recomienda_con.length ? `se recomienda con: ${p.se_recomienda_con.join(', ')}` : '',
        p.cuando_entra_arquitecto ? `entra arquitecto: ${p.cuando_entra_arquitecto}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    )
    .join('\n');
  const paquetes = catalogo.paquetes.map((p) => `- ${p.id} ${p.nombre}: ${p.productos.join(', ')}`).join('\n');
  const reglas = catalogo.reglas_escalamiento.map((r) => `- ${r.id}: ${r.cuando_entra_un_arquitecto}`).join('\n');

  return `Eres el copiloto de un vendedor de soluciones de TI durante una videollamada con un cliente.
Lees la transcripción (Cliente y Vendedor) y le dices al vendedor qué productos del catálogo aplican, qué falta saber y qué preguntar a continuación.
No calculas precios: un programa aparte los toma del catálogo. Nunca inventes productos, cantidades ni datos.

CATÁLOGO

Familias:
${familias}

Productos (sku | familia | nombre | tipo | cobro | señal | preguntas clave | requisitos | recomendaciones | cuándo entra arquitecto):
${productos}

Paquetes:
${paquetes}

Reglas de escalamiento (cuándo un caso necesita arquitecto de soluciones):
${reglas}

QUÉ DEVOLVER
Solo un objeto JSON, sin texto antes ni después, con esta forma:
{
  "empresa": "nombre de la empresa del cliente si lo dijeron, si no null",
  "industria": "giro del cliente en una o dos palabras (ej. Salud, Fintech, Manufactura) si se sabe, si no null",
  "productos": [{ "sku": "SIM-...", "estado": "incluido | pendiente | arquitecto | sugerido", "cantidad": 25, "nota": "texto corto" }],
  "reglas": ["ESC-04"],
  "datos": [{ "dato": "Usuarios", "valor": "25 personas" }],
  "pregunta": { "texto": "...", "motivo": "...", "fuente": "Catálogo · <nombre del producto>" }
}

REGLAS
- Usa solo SKUs que existan arriba. Si el cliente no ha dado ninguna señal clara, "productos" va vacío.
- estado "incluido": el producto aplica y ya tienes lo necesario para cotizarlo (si se cobra por usuario, TB, servidor, equipo o buzón, necesitas la cantidad).
- estado "pendiente": aplica, pero falta un dato para cotizarlo.
- estado "arquitecto": el producto es "a la medida", o el cliente dijo algo que cumple su condición de "entra arquitecto" o una regla ESC.
- estado "sugerido": el catálogo lo recomienda junto a un producto incluido o completa un paquete, pero el cliente no lo pidió. Máximo 2.
- "cantidad": solo si el cliente dijo el número o se deduce directo de lo que dijo. Nunca la supongas.
- "nota": máximo 4 palabras, solo cuando ayude (ej. "3 sucursales", "volver en 1 h"). Si no, omítela.
- "reglas": ids ESC que ya se cumplen por lo que dijo el cliente. No pongas reglas que solo podrían cumplirse.
- "datos": los 3 a 5 datos que más importan para cotizar este caso, con "valor" null si todavía no se sabe. "dato" en máximo 5 palabras.
- "pregunta": la siguiente pregunta más útil para el vendedor. Primero la que podría cambiar si el caso necesita arquitecto (una regla ESC), luego la que dimensiona (usuarios, TB, servidores). Usa el texto de "preguntas clave" del catálogo cuando aplique y pon en "fuente" "Catálogo · " más el nombre del producto; si la redactas tú, "fuente" es "Agente". "motivo" en máximo 12 palabras. Si ya no falta nada para cotizar, "pregunta" es null.
- No repitas una pregunta que el vendedor ya hizo y el cliente ya contestó.
- Todo en español de México.`;
}

interface RespuestaOpenRouter {
  text?: string;
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

async function llamar(config: ConfigApi, ruta: string, cuerpo: unknown): Promise<RespuestaOpenRouter> {
  const respuesta = await fetch(`${OPENROUTER}${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Agente de Ventas' },
    body: JSON.stringify(cuerpo),
  });
  const json = (await respuesta.json().catch(() => ({}))) as RespuestaOpenRouter;
  if (!respuesta.ok) throw new Error(`OpenRouter ${respuesta.status}: ${json.error?.message ?? 'sin detalle'}`);
  return json;
}

function leerCuerpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, falla) => {
    const partes: Buffer[] = [];
    req.on('data', (p: Buffer) => partes.push(p));
    req.on('end', () => ok(Buffer.concat(partes)));
    req.on('error', falla);
  });
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(cuerpo));
}
