// Citas: busca en la conversación la frase del cliente que respalda un dato. Si no aparece, el dato no es
// "Confirmado" (notas/lenguaje-traductor.md, regla 3). Sin dependencias, para que lo use también el servidor.

const NUMEROS: Record<string, string> = {
  uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5',
  seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10', doce: '12', quince: '15', veinte: '20',
};

/** Sin acentos ni signos, en minúsculas y con los números escritos en cifras ("dos servidores" → "2 servidores"). */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((p) => NUMEROS[p] ?? p)
    .join(' ');

export interface Linea {
  quien: string;
  texto: string;
}

/** La frase que contiene el texto citado, o null si nadie lo dijo así en la llamada. */
export function citaLiteral(cita: string, conversacion: Linea[]): string | null {
  const buscada = normalizar(cita);
  if (buscada.length < 3) return null;
  return conversacion.find((l) => normalizar(l.texto).includes(buscada))?.texto ?? null;
}

/**
 * La frase del cliente que respalda un valor ya resumido ("25 usuarios y 25 equipos"): todos sus números tienen
 * que aparecer en lo que dijo el cliente; si no trae números, al menos la mitad de sus palabras.
 */
export function respaldoDe(valor: string, conversacion: Linea[]): string | null {
  const lineas = conversacion.filter((l) => /cliente/i.test(l.quien)).map((l) => ({ texto: l.texto, n: ` ${normalizar(l.texto)} ` }));
  const v = normalizar(valor);
  const numeros = [...new Set(v.match(/\d+/g) ?? [])];
  const palabras = v.split(' ').filter((p) => p.length >= 4 && !/^\d+$/.test(p));
  const numerosEn = (l: { n: string }) => numeros.filter((x) => l.n.includes(` ${x} `)).length;
  const palabrasEn = (l: { n: string }) => palabras.filter((p) => l.n.includes(` ${p}`)).length;
  if (numeros.length) {
    if (!numeros.every((x) => lineas.some((l) => l.n.includes(` ${x} `)))) return null;
  } else if (!palabras.length) {
    return null;
  }
  // La cita es la frase con más números del valor y, para desempatar, más palabras en común.
  const mejor = [...lineas].sort((a, b) => numerosEn(b) * 10 + palabrasEn(b) - (numerosEn(a) * 10 + palabrasEn(a)))[0];
  if (!mejor) return null;
  return numeros.length || palabrasEn(mejor) / palabras.length >= 0.5 ? mejor.texto : null;
}

/** Recorta una cita para mostrarla entre comillas. */
export const recortar = (texto: string, max = 90) => (texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto);
