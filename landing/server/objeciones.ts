// Banco de objeciones del Traductor. La fuente es la tabla `objeciones` en InsForge
// (migrations/20261024231421_banco-de-objeciones.sql); objeciones/objeciones.json es la misma información en el repo
// y sirve de respaldo si InsForge no está configurado o no responde.
// El modelo solo reconoce qué objeción puso el cliente; la pregunta, el «Di mejor» y lo que no hay que decir salen de aquí.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { claveDePregunta } from './ayuda.ts';

export interface Objecion {
  id: string;
  categoria: string;
  objecion: string;
  variantes: string[];
  detras: string | null;
  preguntas: string[];
  di_mejor: string;
  no_decir: string[];
  revisar_legal: boolean;
  /** Llevar el tema a un arquitecto (regulación, migración, seguridad, preguntas técnicas o fuera de catálogo). */
  escalar: boolean;
}

export function bancoLocal(raiz: string): Objecion[] {
  try {
    const archivo = JSON.parse(readFileSync(resolve(raiz, '../objeciones/objeciones.json'), 'utf8')) as { objeciones: Objecion[] };
    return archivo.objeciones;
  } catch (e) {
    console.warn('[objeciones] No se pudo leer objeciones/objeciones.json:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** La lista que ve el modelo: id, categoría y cómo lo dicen los clientes. */
export function objecionesParaElPrompt(banco: Objecion[]) {
  return banco.map((o) => `- ${o.id} [${o.categoria}]: ${o.variantes.map((v) => `"${v}"`).join(' / ')}`).join('\n');
}

const palabrasClave = (texto: string) => claveDePregunta(texto).split(' ').filter((p) => p.length >= 4);

/** El vendedor ya la hizo si la mayoría de sus palabras clave aparecen en alguna de sus frases (aunque la diga a su modo). */
export function yaLaHizo(pregunta: string, delVendedor: string[]) {
  const clave = palabrasClave(pregunta);
  if (!clave.length) return false;
  return delVendedor.some((frase) => {
    const t = ` ${claveDePregunta(frase)}`;
    return clave.filter((p) => t.includes(` ${p}`)).length / clave.length >= 0.6;
  });
}

/** La pregunta que toca: la primera del banco que el vendedor todavía no hizo en esta llamada. */
export function siguientePregunta(objecion: Objecion, transcripcion: { quien: string; texto: string }[]) {
  const delVendedor = transcripcion.filter((t) => /vendedor/i.test(t.quien)).map((t) => t.texto);
  return objecion.preguntas.find((p) => !yaLaHizo(p, delVendedor)) ?? null;
}
