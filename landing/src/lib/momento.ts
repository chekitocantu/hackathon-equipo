// Cola de sugerencias para el vendedor. Las preguntas del agente cambian mientras el cliente habla; para no marear,
// cada pregunta nueva entra a una lista (las últimas 10) solo en un buen momento: nunca mientras el cliente habla,
// sí en una pausa, cuando el cliente toca el tema o cuando la plática va hacia el cierre. Lo que entra ya no cambia
// de texto. El vendedor puede fijar una (clic) y soltarla (otro clic); se marca sola como hecha cuando la pregunta.
import { useEffect, useRef, useState } from 'react';
import type { Pregunta } from './casos';
import type { ItemSugerencia } from '../components/PopupSugerencia';

interface Frase {
  quien: 'Cliente' | 'Vendedor';
  texto: string;
}

const CADA_MS = 400;
const MAXIMO_EN_COLA = 10;
const PAUSA_MS = 3500;           // silencio que cuenta como pausa en la plática
const VENDEDOR_HABLANDO_MS = 2500; // tras una frase del vendedor, se le deja terminar
const TEMA_MS = 1200;            // el cliente tocó el tema: se espera a que acabe la frase
const CIERRE_MS = 800;
const MAXIMO_PENDIENTE_MS = 45_000; // si nunca hubo momento, entra en la primera calma

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
  return dePregunta.find((p) => p.length >= 5 && !VACIAS.has(p) && deFrase.has(p.slice(0, 5))) ?? null;
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

const reloj = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * @param pregunta lo que el agente sugiere preguntar ahora (o null si ya no falta nada).
 * @param frases la conversación hasta ahora.
 * @param activa si la llamada está en curso.
 * @param inicioLlamada Date.now() de cuando empezó la llamada, para la hora de cada sugerencia.
 * @param clienteHablando opcional: true si en este instante hay voz del cliente (medidor de audio).
 */
export function useColaSugerencias(
  pregunta: Pregunta | null,
  frases: Frase[],
  activa: boolean,
  inicioLlamada: number,
  clienteHablando?: () => boolean,
) {
  const [items, setItems] = useState<ItemSugerencia[]>([]);
  const [fijadaId, setFijadaId] = useState<string | null>(null);
  const [minimizado, setMinimizado] = useState(false);
  const estado = useRef({
    pregunta,
    clienteHablando,
    inicioLlamada,
    items: [] as ItemSugerencia[],
    fijadaId: null as string | null,
    vistas: 0,
    revisadas: 0,
    ultimaLlegada: Date.now(),
    ultima: null as Frase | null,
    frases: [] as Frase[],
    candidata: '',
    pendienteDesde: Date.now(),
    siguienteId: 1,
  });
  const e = estado.current;
  e.pregunta = pregunta;
  e.clienteHablando = clienteHablando;
  e.inicioLlamada = inicioLlamada;
  e.items = items;
  e.fijadaId = fijadaId;
  e.frases = frases;

  // Hora en que llegó cada frase nueva: sirve para medir pausas aunque la fuente solo mande texto.
  if (frases.length !== e.vistas) {
    if (frases.length < e.vistas) e.revisadas = 0; // llamada nueva
    e.vistas = frases.length;
    e.ultima = frases[frases.length - 1] ?? null;
    e.ultimaLlegada = Date.now();
  }

  // Llamada nueva (la conversación se vació): se limpia la cola.
  useEffect(() => {
    if (frases.length === 0) {
      setItems([]);
      setFijadaId(null);
      e.candidata = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frases.length === 0]);

  useEffect(() => {
    if (!activa) return;
    const t = window.setInterval(() => {
      const ahora = Date.now();
      const p = e.pregunta;
      let lista = e.items;

      // 1. Lo que el vendedor dijo desde la última revisión marca como hechas las preguntas que ya hizo.
      for (let i = e.revisadas; i < e.frases.length; i++) {
        const f = e.frases[i];
        if (f.quien !== 'Vendedor') continue;
        lista = lista.map((it) => (!it.hecha && yaLaHizo(it.texto, f.texto) ? { ...it, hecha: true } : it));
      }
      e.revisadas = e.frases.length;

      // 2. "Ahora" = la que el agente sigue pidiendo en este momento.
      lista = lista.map((it) => {
        const actual = !!p && misma(it.texto, p.texto);
        return actual === it.actual ? it : { ...it, actual };
      });

      // 3. ¿Entra una pregunta nueva? Solo si no está ya en la cola y es buen momento.
      if (p && !lista.some((it) => misma(it.texto, p.texto))) {
        if (!e.candidata || !misma(e.candidata, p.texto)) {
          e.candidata = p.texto;
          e.pendienteDesde = ahora;
        }
        const desde = ahora - e.ultimaLlegada;
        const ultima = e.ultima;
        const ocupado = e.clienteHablando?.() || (ultima?.quien === 'Vendedor' && desde < VENDEDOR_HABLANDO_MS);
        let oportunidad: string | null = null;
        if (!ocupado) {
          const tema = ultima?.quien === 'Cliente' ? temaEnComun(p.texto, ultima.texto) : null;
          if (ultima && CIERRE.test(ultima.texto) && desde > CIERRE_MS) oportunidad = 'Antes de cerrar la plática';
          else if (tema && desde > TEMA_MS) oportunidad = `El cliente habló de "${tema}"`;
          else if (ultima && desde > PAUSA_MS) oportunidad = 'Hubo una pausa en la plática';
          else if (ahora - e.pendienteDesde > MAXIMO_PENDIENTE_MS && desde > 1500) oportunidad = 'Sigue pendiente';
        }
        if (oportunidad) {
          const nuevo: ItemSugerencia = {
            id: String(e.siguienteId++),
            texto: p.texto,
            motivo: p.motivo,
            fuente: p.fuente,
            cuidado: p.cuidado ?? null,
            diMejor: p.diMejor ?? null,
            oportunidad,
            hora: reloj(ahora - e.inicioLlamada),
            hecha: false,
            actual: true,
          };
          lista = [nuevo, ...lista.map((it) => (it.actual ? { ...it, actual: false } : it))];
          // Se queda con las 10 más nuevas, pero la fijada nunca se va.
          while (lista.length > MAXIMO_EN_COLA) {
            const i = lista.map((it) => it.id !== e.fijadaId).lastIndexOf(true);
            lista = lista.filter((_, j) => j !== i);
          }
        }
      }

      if (lista !== e.items && JSON.stringify(lista) !== JSON.stringify(e.items)) {
        e.items = lista;
        setItems(lista);
      }
    }, CADA_MS);
    return () => window.clearInterval(t);
    // Todo lo que cambia se lee de la ref `estado`; el intervalo solo depende de si la llamada está activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa]);

  return {
    items,
    fijadaId,
    minimizado,
    /** Clic en una pregunta: la fija; clic otra vez: la suelta. */
    alternarFijada: (id: string) => setFijadaId((actual) => (actual === id ? null : id)),
    marcarHecha: (id: string) => setItems((lista) => lista.map((it) => (it.id === id ? { ...it, hecha: true } : it))),
    alternarMinimizado: () => setMinimizado((m) => !m),
  };
}
