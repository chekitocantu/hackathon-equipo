import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Tablero, { Segmentado, type DatoTablero } from '../components/Tablero';
import {
  ANCHO_MINIMO_PANTALLA_COMPLETA,
  AZUL_BOTON,
  AZUL_TEXTO,
  botonPrimario,
  botonTexto,
  NARANJA,
  NARANJA_TEXTO,
  pagina,
  ROJO,
  SECUNDARIO,
  SEPARADOR,
  tarjeta,
  TERCIARIO,
  TEXTO,
  useAnchoVentana,
  VERDE,
  VERDE_TEXTO,
} from '../components/tema';
import { conversacionDeGuion, GUIONES, type Pregunta } from '../lib/casos';
import type { ProductoEnEtapa } from '../lib/cotizador';
import { Segmentador, type Segmento } from '../lib/grabador';

type Quien = 'Cliente' | 'Vendedor';
type Fase = 'preparar' | 'conectando' | 'en-llamada' | 'terminada';

/** De dónde sale la conversación. El tablero y el agente son los mismos para las tres. */
type Fuente =
  | { tipo: 'bot'; codigo: string; vendedor: string }
  | { tipo: 'demo'; caso: number }
  | { tipo: 'pestaña'; soloMicro: boolean; conMicro: boolean };

interface Intervencion {
  clave: string;
  quien: Quien;
  hablante: string;
  texto: string;
  /** Milisegundos desde que empezó la llamada. */
  inicio: number;
}

interface Analisis {
  empresa: string | null;
  productos: ProductoEnEtapa[];
  datos: DatoTablero[];
  reglas: string[];
  pregunta: Pregunta | null;
  /** De InsForge: lo que el cliente ya dijo en otras llamadas y clientes parecidos. null si no hay memoria configurada. */
  memoria: Memoria | null;
  /** Algoritmo de ayuda de IT (server/ayuda.ts): si entra un ingeniero y para qué. */
  ayuda: Ayuda | null;
}

interface Memoria {
  yaSabemos: { etiqueta: string; valor: string; fecha: string }[];
  similares: { empresa: string; industria: string | null; comun: string; productos: string[]; it: string | null }[];
}

interface PuntoIT {
  tema: string;
  motivo: string;
  fuente: string;
}

interface Ayuda {
  tipoCaso: 'estándar' | 'mixto' | 'a la medida' | 'por definir';
  nivel: 'no' | 'consulta' | 'acompaña';
  tecnicas: number;
  total: number;
  entra: PuntoIT[];
  noEntra: PuntoIT[];
  aviso: string;
}

interface SegmentoNotetaker {
  hablante: string;
  rol: Quien;
  texto: string;
  inicio: number;
}

const SIN_ANALISIS: Analisis = { empresa: null, productos: [], datos: [], reglas: [], pregunta: null, memoria: null, ayuda: null };
const CADA_CUANTO_LEER_MS = 1500;
const ESPERA_ADMISION_MS = 120_000;

const reloj = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(ruta, init);
  const json = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json as T;
}

const enviarJson = (cuerpo: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

// Recordar el link y el nombre es solo comodidad del vendedor; si el navegador no deja, no pasa nada.
const recordar = (clave: string, valor?: string) => {
  try {
    if (valor === undefined) return localStorage.getItem(clave) ?? '';
    localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento local */
  }
  return valor ?? '';
};

export default function LlamadaPage() {
  const apilado = useAnchoVentana() < ANCHO_MINIMO_PANTALLA_COMPLETA;
  const [fase, setFase] = useState<Fase>('preparar');
  const [fuente, setFuente] = useState<Fuente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [intervenciones, setIntervenciones] = useState<Intervencion[]>([]);
  const [analisis, setAnalisis] = useState<Analisis>(SIN_ANALISIS);
  const [analizando, setAnalizando] = useState(false);
  const [estadoBot, setEstadoBot] = useState<string | null>(null);
  const [enviadoEn, setEnviadoEn] = useState(0);
  const [inicio, setInicio] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [indiceDemo, setIndiceDemo] = useState(0);
  const [verTranscripcion, setVerTranscripcion] = useState(false);

  const recursos = useRef<{ segmentadores: Segmentador[]; pistas: MediaStreamTrack[] }>({ segmentadores: [], pistas: [] });
  const niveles = useRef<Record<Quien, number>>({ Cliente: 0, Vendedor: 0 });
  const conversacion = useRef<Intervencion[]>([]);
  // Id con el que esta llamada se guarda en InsForge; cambia con cada llamada nueva.
  const llamadaId = useRef('');
  const firma = useRef('');
  const cola = useRef({ corriendo: false, otraVez: false });
  const activa = useRef<{ fuente: Fuente | null; fase: Fase }>({ fuente: null, fase: 'preparar' });
  activa.current = { fuente, fase };

  // Reloj de la pantalla (duración de la llamada, "último texto hace…", espera del bot).
  useEffect(() => {
    if (fase !== 'conectando' && fase !== 'en-llamada') return;
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [fase]);

  // Si el vendedor sale de la página, se suelta el audio y se saca al bot para no dejarlo cobrando.
  useEffect(
    () => () => {
      soltarAudio();
      const { fuente: f, fase: fa } = activa.current;
      if (f?.tipo === 'bot' && (fa === 'conectando' || fa === 'en-llamada')) {
        void fetch('/api/llamada/terminar', { ...enviarJson({ codigo: f.codigo }), keepalive: true });
      }
    },
    [],
  );

  // ── Fuente 1: el notetaker. Se leen las frases cada 1.5 s mientras el bot esté en la reunión. ──
  useEffect(() => {
    if (fuente?.tipo !== 'bot' || (fase !== 'conectando' && fase !== 'en-llamada')) return;
    let vigente = true;
    const leer = async () => {
      try {
        const { estado, segmentos } = await pedir<{ estado: string | null; segmentos: SegmentoNotetaker[] }>(
          `/api/llamada/segmentos?codigo=${encodeURIComponent(fuente.codigo)}&vendedor=${encodeURIComponent(fuente.vendedor)}`,
        );
        if (!vigente) return;
        setEstadoBot(estado);
        if (/fail|error/i.test(estado ?? '')) setError(`El asistente no pudo entrar a la reunión (${estado}).`);
        const yaEscucha = segmentos.length > 0 || /active|in_call|recording|transcrib/i.test(estado ?? '');
        if (yaEscucha && activa.current.fase === 'conectando') {
          setInicio(Date.now());
          setFase('en-llamada');
        }
        recibir(
          segmentos.map((s) => ({
            clave: `${s.hablante}|${s.inicio.toFixed(1)}`,
            quien: s.rol,
            hablante: s.hablante,
            texto: s.texto,
            inicio: s.inicio * 1000,
          })),
        );
        setAviso(null);
      } catch (e) {
        if (vigente) setAviso(`Notetaker: ${e instanceof Error ? e.message : e}`);
      }
    };
    void leer();
    const t = window.setInterval(leer, CADA_CUANTO_LEER_MS);
    return () => {
      vigente = false;
      window.clearInterval(t);
    };
    // `recibir` solo usa refs; no hace falta volver a suscribirse cuando cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, fase]);

  // ── Fuente 2: modo demo. Dice una línea del guion, espera lo que tardaría en decirse y sigue. ──
  useEffect(() => {
    if (fuente?.tipo !== 'demo' || fase !== 'en-llamada') return;
    const lineas = conversacionDeGuion(GUIONES[fuente.caso]);
    if (indiceDemo >= lineas.length) return;
    const anterior = lineas[indiceDemo - 1];
    const espera = anterior ? Math.max(2500, anterior.texto.length * 55) : 1200;
    const t = window.setTimeout(() => {
      const linea = lineas[indiceDemo];
      const momento = Date.now() - inicio;
      recibir([
        ...conversacion.current,
        { clave: String(indiceDemo), quien: linea.quien, hablante: linea.quien, texto: linea.texto, inicio: momento },
      ]);
      setIndiceDemo((i) => i + 1);
    }, espera);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, fase, indiceDemo]);

  /** Recibe la conversación completa de cualquier fuente; si cambió algo, el agente la vuelve a leer. */
  function recibir(lista: Intervencion[]) {
    const nueva = lista.map((i) => `${i.quien}:${i.texto}`).join('\n');
    if (nueva === firma.current) return;
    firma.current = nueva;
    conversacion.current = lista;
    setIntervenciones(lista);
    void analizar();
  }

  // Solo un análisis a la vez; si llegó texto nuevo mientras tanto, se vuelve a correr con todo.
  async function analizar() {
    if (cola.current.corriendo) {
      cola.current.otraVez = true;
      return;
    }
    cola.current.corriendo = true;
    setAnalizando(true);
    try {
      const resultado = await pedir<Analisis>(
        '/api/analizar',
        enviarJson({
          transcripcion: conversacion.current.map(({ quien, texto }) => ({ quien, texto })),
          llamada: datosDeLlamada(),
        }),
      );
      setAnalisis(resultado);
      setAviso(null);
    } catch (e) {
      setAviso(`Agente: ${e instanceof Error ? e.message : e}`);
    } finally {
      cola.current.corriendo = false;
      setAnalizando(false);
      if (cola.current.otraVez) {
        cola.current.otraVez = false;
        void analizar();
      }
    }
  }

  function datosDeLlamada() {
    const f = activa.current.fuente;
    return {
      id: llamadaId.current,
      origen: f?.tipo === 'bot' ? 'meet' : (f?.tipo ?? 'demo'),
      codigo: f?.tipo === 'bot' ? f.codigo : undefined,
    };
  }

  function reiniciar(nueva: Fuente) {
    llamadaId.current = crypto.randomUUID();
    conversacion.current = [];
    firma.current = '';
    setIntervenciones([]);
    setAnalisis(SIN_ANALISIS);
    setAviso(null);
    setError(null);
    setEstadoBot(null);
    setIndiceDemo(0);
    setVerTranscripcion(false);
    setFuente(nueva);
  }

  async function enviarAsistente(link: string, vendedor: string) {
    setError(null);
    try {
      const { codigo } = await pedir<{ codigo: string }>('/api/llamada/iniciar', enviarJson({ link }));
      recordar('llamada:link', link);
      recordar('llamada:vendedor', vendedor);
      reiniciar({ tipo: 'bot', codigo, vendedor });
      setEnviadoEn(Date.now());
      setAhora(Date.now());
      setFase('conectando');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function verDemo(caso: number) {
    reiniciar({ tipo: 'demo', caso });
    setInicio(Date.now());
    setAhora(Date.now());
    setFase('en-llamada');
  }

  // ── Fuente 3 (respaldo sin bot): captura la pestaña de Meet y transcribe con Whisper. ──
  async function capturarPestana(soloMicro: boolean, conMicro: boolean) {
    setError(null);
    try {
      const fuentes: { quien: Quien; stream: MediaStream }[] = [];
      if (!soloMicro) {
        const pantalla = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          preferCurrentTab: false,
          selfBrowserSurface: 'exclude',
          systemAudio: 'include',
        } as DisplayMediaStreamOptions);
        if (pantalla.getAudioTracks().length === 0) {
          pantalla.getTracks().forEach((p) => p.stop());
          throw new Error('No llegó audio. Elige la pestaña de Meet y activa "Compartir también el audio de la pestaña".');
        }
        // Si el vendedor da clic en "Dejar de compartir" en Chrome, la llamada termina.
        pantalla.getTracks().forEach((p) => p.addEventListener('ended', () => void terminar()));
        fuentes.push({ quien: 'Cliente', stream: pantalla });
      }
      if (soloMicro || conMicro) {
        const micro = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        // En modo prueba, lo que entra por el micrófono se trata como si fuera el cliente.
        fuentes.push({ quien: soloMicro ? 'Cliente' : 'Vendedor', stream: micro });
      }

      reiniciar({ tipo: 'pestaña', soloMicro, conMicro });
      const empezo = Date.now();
      recursos.current = {
        pistas: fuentes.flatMap((f) => f.stream.getTracks()),
        segmentadores: fuentes.map(
          ({ quien, stream }) =>
            new Segmentador(
              stream,
              (segmento) => void transcribir(quien, segmento, empezo),
              (nivel) => (niveles.current[quien] = nivel),
            ),
        ),
      };
      setInicio(empezo);
      setAhora(empezo);
      setFase('en-llamada');
    } catch (e) {
      soltarAudio();
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setError('No hubo permiso para el audio. Vuelve a intentar y acepta compartir; si no aparece la ventana, revisa los permisos del sitio en Chrome.');
      } else setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function transcribir(quien: Quien, segmento: Segmento, empezo: number) {
    try {
      const { texto } = await pedir<{ texto: string }>('/api/transcribir', {
        method: 'POST',
        headers: { 'Content-Type': segmento.blob.type || 'audio/webm' },
        body: segmento.blob,
      });
      if (!texto) return;
      const nueva = { clave: `${quien}|${segmento.inicio}`, quien, hablante: quien, texto, inicio: segmento.inicio - empezo };
      // Cliente y vendedor se transcriben en paralelo; se acomodan por la hora en que se dijeron.
      recibir([...conversacion.current, nueva].sort((a, b) => a.inicio - b.inicio));
    } catch (e) {
      setAviso(`Transcripción: ${e instanceof Error ? e.message : e}`);
    }
  }

  function soltarAudio() {
    recursos.current.segmentadores.forEach((s) => s.detener());
    recursos.current.pistas.forEach((p) => p.stop());
    recursos.current = { segmentadores: [], pistas: [] };
  }

  async function terminar() {
    const f = activa.current.fuente;
    soltarAudio();
    setFase('terminada');
    setAhora(Date.now());
    if (f?.tipo === 'bot') {
      try {
        await pedir('/api/llamada/terminar', enviarJson({ codigo: f.codigo }));
      } catch (e) {
        setAviso(`No se pudo sacar al asistente: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  async function cancelarEnvio() {
    await terminar();
    setFase('preparar');
  }

  // ── Pantallas ──
  if (fase === 'preparar') {
    return <Preparar error={error} enviarAsistente={enviarAsistente} verDemo={verDemo} capturarPestana={capturarPestana} />;
  }

  if (fase === 'conectando' && fuente?.tipo === 'bot') {
    return (
      <Conectando
        codigo={fuente.codigo}
        estado={estadoBot}
        esperandoMs={ahora - enviadoEn}
        error={error ?? aviso}
        reenviar={() => void enviarAsistente(fuente.codigo, fuente.vendedor)}
        cancelar={() => void cancelarEnvio()}
      />
    );
  }

  const ultimoCliente = [...intervenciones].reverse().find((i) => i.quien === 'Cliente');
  const ultimaFrase = intervenciones[intervenciones.length - 1];
  const participantes = [...new Map(intervenciones.map((i) => [i.hablante, i.quien])).entries()];
  const etiquetaFuente =
    fuente?.tipo === 'bot'
      ? 'Asistente en Meet'
      : fuente?.tipo === 'demo'
        ? `Modo demo · ${GUIONES[fuente.caso].nombreCorto}`
        : fuente?.soloMicro
          ? 'Prueba con micrófono'
          : 'Captura de la pestaña de Meet';
  const titulo = analisis.empresa ?? (fuente?.tipo === 'demo' ? GUIONES[fuente.caso].caso.empresa : 'Llamada en vivo');

  return (
    <div style={pagina(apilado)}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: apilado ? 'wrap' : 'nowrap' }}>
        <div style={{ flexShrink: 0, minWidth: 0 }}>
          <Link to="/" style={{ color: AZUL_TEXTO, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
            ‹ Inicio
          </Link>
          <h1 style={{ margin: '2px 0 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>{titulo}</h1>
          <p style={{ margin: '3px 0 0', fontSize: '0.92rem', color: SECUNDARIO, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {fase === 'en-llamada' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ROJO }} />}
            {fase === 'en-llamada' ? etiquetaFuente : 'Llamada terminada'} · {reloj(ahora - inicio)}
            {fase === 'en-llamada' && ultimaFrase && ` · último texto hace ${Math.max(0, Math.round((ahora - inicio - ultimaFrase.inicio) / 1000))} s`}
            {analizando && <span style={{ color: AZUL_TEXTO }}>· El agente está pensando…</span>}
          </p>
        </div>

        {fuente?.tipo === 'bot' && participantes.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {participantes.map(([nombre, rol]) => (
              <Chip key={nombre} destacado={rol === 'Vendedor'}>
                {nombre} · {rol === 'Vendedor' ? 'vendedor' : 'cliente'}
              </Chip>
            ))}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {aviso && <span style={{ fontSize: '0.8rem', color: NARANJA_TEXTO, maxWidth: '340px' }}>{aviso}</span>}
          {fase === 'en-llamada' && fuente?.tipo === 'pestaña' && (
            <>
              <Medidor etiqueta={fuente.soloMicro ? 'Micrófono' : 'Cliente (Meet)'} leer={() => niveles.current.Cliente} />
              {!fuente.soloMicro && fuente.conMicro && <Medidor etiqueta="Tú" leer={() => niveles.current.Vendedor} />}
            </>
          )}
          {fase === 'en-llamada' ? (
            <button style={{ ...botonPrimario, backgroundColor: '#ffffff', color: ROJO, boxShadow: 'inset 0 0 0 1px #ffd1cf' }} onClick={() => void terminar()}>
              {fuente?.tipo === 'bot' ? 'Sacar asistente y terminar' : 'Terminar'}
            </button>
          ) : (
            <>
              <button style={botonTexto} onClick={() => setVerTranscripcion((v) => !v)}>
                {verTranscripcion ? 'Ver tablero' : 'Ver transcripción'}
              </button>
              <button style={botonPrimario} onClick={() => setFase('preparar')}>
                Nueva llamada
              </button>
            </>
          )}
        </div>
      </header>

      {!verTranscripcion && analisis.ayuda && <PanelAyuda ayuda={analisis.ayuda} apilado={apilado} />}
      {!verTranscripcion && analisis.memoria && <PanelMemoria memoria={analisis.memoria} apilado={apilado} />}

      {verTranscripcion ? (
        <Transcripcion intervenciones={intervenciones} />
      ) : (
        <Tablero
          apilado={apilado}
          mensaje={{
            rotulo: ultimoCliente ? `${ultimoCliente.hablante} · ${reloj(ultimoCliente.inicio)}` : 'Cliente',
            texto: ultimoCliente?.texto ?? null,
            vacio: fase === 'en-llamada' ? 'Escuchando al cliente…' : 'El cliente no habló durante la llamada.',
          }}
          productos={analisis.productos}
          datos={analisis.datos}
          reglas={analisis.reglas}
          pregunta={analisis.pregunta}
          esperando={
            intervenciones.length === 0
              ? 'La primera pregunta aparece cuando el cliente cuente su problema.'
              : 'El agente todavía no detecta un producto del catálogo. Pregunta qué problema quieren resolver.'
          }
        />
      )}
    </div>
  );
}

const campo: CSSProperties = {
  width: '100%',
  height: '44px',
  boxSizing: 'border-box',
  borderRadius: '12px',
  border: '1px solid #d2d2d7',
  padding: '0 14px',
  fontSize: '1rem',
  fontFamily: 'inherit',
  color: TEXTO,
  backgroundColor: '#ffffff',
};

function Preparar({
  error,
  enviarAsistente,
  verDemo,
  capturarPestana,
}: {
  error: string | null;
  enviarAsistente: (link: string, vendedor: string) => Promise<void>;
  verDemo: (caso: number) => void;
  capturarPestana: (soloMicro: boolean, conMicro: boolean) => Promise<void>;
}) {
  const [link, setLink] = useState(() => recordar('llamada:link'));
  const [vendedor, setVendedor] = useState(() => recordar('llamada:vendedor'));
  const [caso, setCaso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [respaldo, setRespaldo] = useState(false);
  const [conMicro, setConMicro] = useState(true);
  const [falta, setFalta] = useState<string | null>(null);

  const enviar = async () => {
    if (!link.trim()) return setFalta('Pega el link de la reunión.');
    if (!vendedor.trim()) return setFalta('Escribe tu nombre como aparece en Meet.');
    setFalta(null);
    setEnviando(true);
    await enviarAsistente(link.trim(), vendedor.trim());
    setEnviando(false);
  };

  return (
    <div style={{ ...pagina(true), justifyContent: 'center', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Link to="/" style={{ color: AZUL_TEXTO, textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
          ‹ Inicio
        </Link>
        <h1 style={{ margin: '10px 0 8px', fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
          Enlaza tu llamada
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: '1.1rem', color: SECUNDARIO, lineHeight: 1.45 }}>
          El asistente entra a tu Google Meet, toma notas y te dice qué preguntar y cuánto cotizar.
        </p>

        <div style={{ ...tarjeta, padding: '24px 28px' }}>
          <label style={{ display: 'block', fontSize: '0.88rem', color: SECUNDARIO, marginBottom: '6px' }} htmlFor="link">
            Link de la reunión
          </label>
          <input
            id="link"
            style={campo}
            placeholder="meet.google.com/abc-defg-hij"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setFalta(null);
            }}
          />
          <label style={{ display: 'block', fontSize: '0.88rem', color: SECUNDARIO, margin: '14px 0 6px' }} htmlFor="vendedor">
            Tu nombre en Meet
          </label>
          <input
            id="vendedor"
            style={campo}
            placeholder="Karim García"
            value={vendedor}
            onChange={(e) => {
              setVendedor(e.target.value);
              setFalta(null);
            }}
          />
          <p style={{ margin: '6px 0 18px', fontSize: '0.8rem', color: TERCIARIO }}>Con tu nombre sabemos qué dijiste tú y qué dijo el cliente.</p>
          <button
            style={{ ...botonPrimario, width: '100%', padding: '13px 20px', fontSize: '1rem', opacity: enviando ? 0.6 : 1 }}
            disabled={enviando}
            onClick={() => void enviar()}
          >
            {enviando ? 'Enviando…' : 'Enviar asistente a la reunión'}
          </button>
          {(falta || error) && <p style={{ margin: '12px 0 0', fontSize: '0.9rem', color: ROJO, lineHeight: 1.45 }}>{falta ?? error}</p>}
          <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: TERCIARIO, lineHeight: 1.45 }}>
            Avísale al cliente que entra un asistente que toma notas de la llamada.
          </p>
        </div>

        <div style={{ ...tarjeta, padding: '20px 28px', marginTop: '14px' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>¿Sin reunión a la mano?</p>
          <p style={{ margin: '4px 0 12px', fontSize: '0.9rem', color: SECUNDARIO, lineHeight: 1.45 }}>
            El modo demo reproduce una conversación de ejemplo y el agente real la analiza en vivo.
          </p>
          <Segmentado
            etiqueta="Caso del modo demo"
            compacto
            elegido={caso}
            alElegir={setCaso}
            opciones={GUIONES.map((g) => ({ id: g.caso.id, titulo: g.nombreCorto }))}
          />
          <button style={{ ...botonTexto, padding: '12px 0 0' }} onClick={() => verDemo(caso)}>
            Ver demo ›
          </button>
        </div>

        <div style={{ margin: '14px 4px 0' }}>
          <button style={{ ...botonTexto, padding: 0, fontSize: '0.85rem', color: SECUNDARIO }} onClick={() => setRespaldo((r) => !r)}>
            {respaldo ? 'Ocultar respaldo sin bot' : 'Respaldo sin bot: capturar la pestaña de Meet ›'}
          </button>
          {respaldo && (
            <div style={{ marginTop: '10px', fontSize: '0.88rem', color: SECUNDARIO, lineHeight: 1.5 }}>
              Comparte la pestaña de Meet con su audio y se transcribe con Whisper. Funciona en Chrome o Edge; usa audífonos.
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={conMicro} onChange={(e) => setConMicro(e.target.checked)} style={{ accentColor: AZUL_BOTON }} />
                Escuchar también mi micrófono
              </label>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <button style={{ ...botonTexto, padding: 0 }} onClick={() => void capturarPestana(false, conMicro)}>
                  Capturar pestaña de Meet
                </button>
                <button style={{ ...botonTexto, padding: 0 }} onClick={() => void capturarPestana(true, false)}>
                  Probar solo con micrófono
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Conectando({
  codigo,
  estado,
  esperandoMs,
  error,
  reenviar,
  cancelar,
}: {
  codigo: string;
  estado: string | null;
  esperandoMs: number;
  error: string | null;
  reenviar: () => void;
  cancelar: () => void;
}) {
  const tardo = esperandoMs > ESPERA_ADMISION_MS;
  const pasos: { texto: string; detalle?: string; estado: 'listo' | 'ahora' | 'despues' }[] = [
    { texto: 'Asistente enviado', detalle: `Reunión ${codigo}`, estado: 'listo' },
    {
      texto: 'Admítelo en Meet',
      detalle: tardo ? 'Lleva más de 2 minutos esperando. Revisa la ventana de Meet o vuelve a enviarlo.' : 'Aparece como “Asistente de ventas”.',
      estado: 'ahora',
    },
    { texto: 'Escuchando la reunión', estado: 'despues' },
  ];

  return (
    <div style={{ ...pagina(true), justifyContent: 'center', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <h1 style={{ margin: '0 0 18px', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Conectando</h1>
        <div style={{ ...tarjeta, padding: '22px 26px' }}>
          {pasos.map((p) => (
            <div key={p.texto} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '9px 0' }}>
              <Punto estado={p.estado} />
              <div>
                <div style={{ fontSize: '1rem', fontWeight: p.estado === 'ahora' ? 700 : 500, color: p.estado === 'despues' ? TERCIARIO : TEXTO }}>{p.texto}</div>
                {p.detalle && <div style={{ fontSize: '0.85rem', color: tardo && p.estado === 'ahora' ? NARANJA_TEXTO : SECUNDARIO, marginTop: '2px' }}>{p.detalle}</div>}
              </div>
            </div>
          ))}
          <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: TERCIARIO }}>
            Esperando {reloj(esperandoMs)}
            {estado && ` · estado del asistente: ${estado}`}
          </p>
          {error && <p style={{ margin: '10px 0 0', fontSize: '0.9rem', color: ROJO, lineHeight: 1.45 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
            {(tardo || error) && (
              <button style={botonPrimario} onClick={reenviar}>
                Volver a enviar
              </button>
            )}
            <button style={{ ...botonTexto, color: SECUNDARIO }} onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Transcripcion({ intervenciones }: { intervenciones: Intervencion[] }) {
  return (
    <section style={{ ...tarjeta, flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 700 }}>Transcripción</h2>
      {intervenciones.length === 0 && <p style={{ color: TERCIARIO }}>No hubo conversación.</p>}
      {intervenciones.map((i) => (
        <div key={i.clave} style={{ display: 'flex', gap: '16px', padding: '10px 0', borderBottom: `1px solid ${SEPARADOR}` }}>
          <span style={{ width: '150px', flexShrink: 0, fontSize: '0.85rem', color: i.quien === 'Vendedor' ? AZUL_TEXTO : SECUNDARIO }}>
            {reloj(i.inicio)} · {i.hablante}
          </span>
          <span style={{ fontSize: '0.95rem', lineHeight: 1.45 }}>{i.texto}</span>
        </div>
      ))}
    </section>
  );
}

/** ¿Necesitas a IT? Tipo de caso, cuántas preguntas son técnicas y qué partes SÍ y cuáles NO llevan ingeniero. */
function PanelAyuda({ ayuda, apilado }: { ayuda: Ayuda; apilado: boolean }) {
  const color = ayuda.nivel === 'no' ? VERDE : ayuda.nivel === 'consulta' ? NARANJA : ROJO;
  const textoColor = ayuda.nivel === 'no' ? VERDE_TEXTO : ayuda.nivel === 'consulta' ? NARANJA_TEXTO : ROJO;
  const titulo = ayuda.nivel === 'no' ? 'No necesitas a IT' : ayuda.nivel === 'consulta' ? 'IT revisa una parte' : 'Pide apoyo de IT';
  const proporcion = ayuda.total ? ayuda.tecnicas / ayuda.total : 0;
  const rotulo: CSSProperties = { margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 700, color: TERCIARIO, letterSpacing: '0.02em' };
  const lista = (puntos: PuntoIT[], vacio: string) =>
    puntos.length ? (
      puntos.slice(0, 4).map((p) => (
        <p key={p.tema + p.fuente} style={{ margin: '0 0 4px', fontSize: '0.86rem', color: TEXTO }}>
          <strong>{p.tema}</strong> <span style={{ color: SECUNDARIO }}>· {p.motivo}</span>
        </p>
      ))
    ) : (
      <p style={{ margin: 0, fontSize: '0.86rem', color: TERCIARIO }}>{vacio}</p>
    );
  return (
    <section style={{ ...tarjeta, padding: '14px 20px', display: 'grid', gap: '12px', borderLeft: `4px solid ${color}`, borderRadius: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: textoColor }}>{titulo}</span>
        <Chip>Caso {ayuda.tipoCaso}</Chip>
        {ayuda.total > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: SECUNDARIO }}>
            <span style={{ width: '90px', height: '6px', borderRadius: '3px', backgroundColor: SEPARADOR, overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${Math.round(proporcion * 100)}%`, height: '100%', backgroundColor: proporcion >= 0.6 ? ROJO : AZUL_BOTON }} />
            </span>
            {ayuda.tecnicas} de {ayuda.total} preguntas técnicas
          </span>
        )}
        <span style={{ fontSize: '0.88rem', color: TEXTO, flex: '1 1 260px' }}>{ayuda.aviso}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: apilado ? '1fr' : '1fr 1fr', gap: '18px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={rotulo}>SÍ ENTRA EL INGENIERO</p>
          {lista(ayuda.entra, 'Nada por ahora.')}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={rotulo}>NO HACE FALTA: LO RESUELVES TÚ</p>
          {lista(ayuda.noEntra, 'Todavía no hay productos estándar.')}
        </div>
      </div>
    </section>
  );
}

/** Lo que viene de InsForge: datos que el cliente ya dio en otra llamada y clientes parecidos. */
function PanelMemoria({ memoria, apilado }: { memoria: Memoria; apilado: boolean }) {
  if (!memoria.yaSabemos.length && !memoria.similares.length) return null;
  const rotulo: CSSProperties = { margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 700, color: TERCIARIO, letterSpacing: '0.02em' };
  return (
    <section
      style={{
        ...tarjeta,
        padding: '14px 20px',
        display: 'grid',
        gridTemplateColumns: apilado || !memoria.yaSabemos.length || !memoria.similares.length ? '1fr' : '1fr 1fr',
        gap: '18px',
      }}
    >
      {memoria.yaSabemos.length > 0 && (
        <div style={{ minWidth: 0 }}>
          <p style={rotulo}>YA LO SABEMOS DE OTRA LLAMADA</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {memoria.yaSabemos.slice(0, 6).map((d) => (
              <Chip key={d.etiqueta} destacado>
                {d.etiqueta}: {d.valor} · {d.fecha}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {memoria.similares.length > 0 && (
        <div style={{ minWidth: 0 }}>
          <p style={rotulo}>CLIENTES PARECIDOS</p>
          {memoria.similares.map((s) => (
            <p key={s.empresa} style={{ margin: '0 0 4px', fontSize: '0.88rem', color: TEXTO }}>
              <strong>{s.empresa}</strong>
              {s.industria ? ` (${s.industria})` : ''} · <span style={{ color: SECUNDARIO }}>{s.comun}</span>
              {s.productos.length > 0 && <span style={{ color: TERCIARIO }}> · se le ofreció {s.productos.join(', ')}</span>}
              {s.it && <span style={{ color: TERCIARIO }}> · {s.it}</span>}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function Chip({ children, destacado }: { children: ReactNode; destacado?: boolean }) {
  return (
    <span
      style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: '9999px',
        backgroundColor: destacado ? '#eaf7ff' : '#f2f2f7',
        color: destacado ? AZUL_TEXTO : SECUNDARIO,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Punto({ estado }: { estado: 'listo' | 'ahora' | 'despues' }) {
  return (
    <span
      style={{
        width: '22px',
        height: '22px',
        flexShrink: 0,
        borderRadius: '50%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: estado === 'listo' ? VERDE : 'transparent',
        border: estado === 'listo' ? 'none' : `2px solid ${estado === 'ahora' ? NARANJA : '#c7c7cc'}`,
      }}
    >
      {estado === 'listo' && (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 5.2l2 2L8 3" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** Barritas de volumen: confirman que sí está llegando audio de cada lado (solo en el respaldo sin bot). */
function Medidor({ etiqueta, leer }: { etiqueta: string; leer: () => number }) {
  const [nivel, setNivel] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setNivel(leer()), 150);
    return () => window.clearInterval(t);
  }, [leer]);
  const encendidas = Math.min(5, Math.round(nivel * 60));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: SECUNDARIO }}>
      <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: '3px',
              height: `${6 + i * 2.5}px`,
              borderRadius: '2px',
              backgroundColor: i < encendidas ? VERDE : '#d1d1d6',
              transition: 'background-color 0.1s',
            }}
          />
        ))}
      </span>
      {etiqueta}
    </span>
  );
}
