// Decide cuándo mostrarle al vendedor la sugerencia del agente sin interrumpir: nunca mientras el cliente habla,
// sí en una pausa, cuando el cliente toca el tema de la pregunta o cuando la plática va hacia el cierre.
// Se quita sola cuando el agente ya no la pide (porque se contestó) o cuando el vendedor ya la hizo.
import { useEffect, useRef, useState } from 'react';
import type { Pregunta } from './casos';

export interface Sugerencia extends Pregunta {
  /** Por qué aparece justo ahora, para que el vendedor entienda el momento. */
  oportunidad: string;
}

interface Frase {
  quien: 'Cliente' | 'Vendedor';
  texto: string;
}

const CADA_MS = 400;
const PAUSA_MS = 3500;           // silencio que cuenta como pausa en la plática
const VENDEDOR_HABLANDO_MS = 2500; // tras una frase del vendedor, se le deja terminar
const TEMA_MS = 1200;            // el cliente tocó el tema: se espera a que acabe la frase
const CIERRE_MS = 800;
const MAXIMO_PENDIENTE_MS = 45_000; // si nunca hubo momento, se muestra en la primera calma
const POSPONER_MS = 30_000;

// Solo frases de despedida o de "ya terminamos"; "cotización" o "propuesta" salen desde el inicio y no cuentan.
// "¿Algo más?" solo cuenta como pregunta al final ("queremos algo más seguro" no es cierre).
const CIERRE = /(algo m[aá]s\s*(\?|$)|\bser[ií]a todo\b|\beso es todo\b|\bsiguiente paso\b|\bme la mandas?\b|\bnos vemos\b|\bqued[oa] claro\b|\bcu[aá]ndo (me|nos) (la|lo) (mandan|env[ií]an)\b)/i;

// Palabras que no dicen de qué trata una pregunta.
const VACIAS = new Set(
  'cuantos cuantas cuanto cuanta tienen tienes ustedes usted necesitan necesitas quieren quieres sobre cuando donde ahora alguna algun alguno tambien cuales porque estan tiene hacer pueden puede seria serian todos todas mucho mucha otras otros entre desde hasta tipo forma manera cosas parte hacen usan usando ellos ellas nuestro nuestra'.split(' '),
);

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Raíces de las palabras que importan (5 letras bastan para que "sucursal" y "sucursales" coincidan). */
function claves(texto: string): string[] {
  const palabras = normalizar(texto).match(/[a-z0-9]+/g) ?? [];
  return [...new Set(palabras.filter((p) => (p.length >= 5 && !VACIAS.has(p)) || /^\d+$/.test(p)).map((p) => p.slice(0, 5)))];
}

/** Palabra de la pregunta que el cliente acaba de mencionar, si hay. */
function temaEnComun(pregunta: string, frase: string): string | null {
  const dePregunta = normalizar(pregunta).match(/[a-z0-9]+/g) ?? [];
  const deFrase = new Set(claves(frase));
  const palabra = dePregunta.find((p) => p.length >= 5 && !VACIAS.has(p) && deFrase.has(p.slice(0, 5)));
  return palabra ?? null;
}

/** El agente reescribe la misma pregunta entre análisis ("¿…equipos tienen?" / "¿…equipos?"): cuenta como la misma. */
function misma(a: string, b: string): boolean {
  if (normalizar(a) === normalizar(b)) return true;
  const ca = claves(a);
  const cb = new Set(claves(b));
  if (ca.length === 0 || cb.size === 0) return false;
  // Contra la más corta: si el agente le agrega una segunda pregunta a la misma, sigue siendo la misma.
  const comunes = ca.filter((c) => cb.has(c)).length;
  return comunes / Math.min(ca.length, cb.size) >= 0.6;
}

/** El vendedor ya hizo la pregunta con sus palabras: comparte al menos la mitad de las palabras clave. */
function yaLaHizo(pregunta: string, frase: string): boolean {
  const deseadas = claves(pregunta);
  if (deseadas.length === 0) return false;
  const dichas = new Set(claves(frase));
  const coinciden = deseadas.filter((c) => dichas.has(c)).length;
  return coinciden >= Math.min(2, deseadas.length) && coinciden / deseadas.length >= 0.5;
}

/**
 * @param pregunta lo que el agente sugiere preguntar ahora (o null si ya no falta nada).
 * @param frases la conversación hasta ahora.
 * @param activa si la llamada está en curso.
 * @param clienteHablando opcional: true si en este instante hay voz del cliente (medidor de audio).
 */
export function useMomentoOportuno(
  pregunta: Pregunta | null,
  frases: Frase[],
  activa: boolean,
  clienteHablando?: () => boolean,
) {
  const [mostrada, setMostrada] = useState<Sugerencia | null>(null);
  const estado = useRef({
    pregunta,
    clienteHablando,
    vistas: 0,
    ultimaLlegada: Date.now(),
    ultima: null as Frase | null,
    mostradaEn: 0,
    candidata: '',
    pendienteDesde: Date.now(),
    hechas: [] as string[],
    pospuestas: [] as { texto: string; hasta: number }[],
    mostrada: null as Sugerencia | null,
  });
  const e = estado.current;
  e.pregunta = pregunta;
  e.clienteHablando = clienteHablando;
  e.mostrada = mostrada;

  // Hora en que llegó cada frase nueva: sirve para medir pausas aunque la fuente solo mande texto.
  if (frases.length !== e.vistas) {
    if (frases.length < e.vistas) {
      // Llamada nueva: se olvida todo lo anterior.
      e.hechas = [];
      e.pospuestas = [];
      e.candidata = '';
    }
    e.vistas = frases.length;
    e.ultima = frases[frases.length - 1] ?? null;
    e.ultimaLlegada = Date.now();
  }

  useEffect(() => {
    if (!activa) {
      setMostrada(null);
      return;
    }
    const t = window.setInterval(() => {
      const ahora = Date.now();
      const p = e.pregunta;

      if (e.mostrada) {
        const ultima = e.ultima;
        const hecha = ultima?.quien === 'Vendedor' && e.ultimaLlegada > e.mostradaEn && yaLaHizo(e.mostrada.texto, ultima.texto);
        if (hecha) e.hechas.push(e.mostrada.texto);
        // Se quita si el vendedor ya la hizo o si el agente dejó de pedirla (ya se contestó o pasó a otra).
        if (hecha || !p || !misma(e.mostrada.texto, p.texto)) setMostrada(null);
        // Misma pregunta con otras palabras: se queda abierta y se actualiza el texto.
        else if (p.texto !== e.mostrada.texto) setMostrada({ ...p, oportunidad: e.mostrada.oportunidad });
        return;
      }

      if (!p || e.hechas.some((h) => misma(h, p.texto))) return;
      if (e.pospuestas.some((x) => x.hasta > ahora && misma(x.texto, p.texto))) return;
      if (!e.candidata || !misma(e.candidata, p.texto)) {
        e.candidata = p.texto;
        e.pendienteDesde = ahora;
      }

      const desde = ahora - e.ultimaLlegada;
      const ultima = e.ultima;
      if (e.clienteHablando?.()) return;
      if (ultima?.quien === 'Vendedor' && desde < VENDEDOR_HABLANDO_MS) return;

      let oportunidad: string | null = null;
      const tema = ultima?.quien === 'Cliente' ? temaEnComun(p.texto, ultima.texto) : null;
      if (ultima && CIERRE.test(ultima.texto) && desde > CIERRE_MS) oportunidad = 'Antes de cerrar la plática';
      else if (tema && desde > TEMA_MS) oportunidad = `El cliente habló de "${tema}"`;
      else if (ultima && desde > PAUSA_MS) oportunidad = 'Hubo una pausa en la plática';
      else if (ahora - e.pendienteDesde > MAXIMO_PENDIENTE_MS && desde > 1500) oportunidad = 'Sigue pendiente';

      if (oportunidad) {
        e.mostradaEn = ahora;
        setMostrada({ ...p, oportunidad });
      }
    }, CADA_MS);
    return () => window.clearInterval(t);
    // Todo lo que cambia se lee de la ref `estado`; el intervalo solo depende de si la llamada está activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa]);

  const cerrar = (como: 'hecha' | 'pospuesta') => {
    if (!mostrada) return;
    if (como === 'hecha') e.hechas.push(mostrada.texto);
    else e.pospuestas.push({ texto: mostrada.texto, hasta: Date.now() + POSPONER_MS });
    setMostrada(null);
  };

  return {
    sugerencia: mostrada,
    hacerla: () => cerrar('hecha'),
    posponer: () => cerrar('pospuesta'),
    descartar: () => cerrar('hecha'),
  };
}
