// Corta un audio en vivo en intervenciones: graba sin parar y, cuando alguien deja de hablar,
// cierra el archivo y empieza otro. Así cada pedazo es un webm completo que Whisper entiende
// y no se cortan palabras a la mitad.

export interface Segmento {
  blob: Blob;
  /** Momento (Date.now) en que empezó la grabación del pedazo. */
  inicio: number;
}

const SILENCIO_PARA_CORTAR_MS = 900;
const MAXIMO_POR_SEGMENTO_MS = 15000;
const SIN_VOZ_REINICIAR_MS = 8000;
const VOZ_MINIMA_MS = 300;
const CADA_MS = 100;

const TIPO = ['audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));

export class Segmentador {
  private contexto = new AudioContext();
  private analizador: AnalyserNode;
  private muestras: Float32Array<ArrayBuffer>;
  private actual: { grabadora: MediaRecorder; inicio: number; enviar: boolean } | null = null;
  private vozMs = 0;
  private ultimaVoz = 0;
  private intervalo: number;
  private activo = true;
  private stream: MediaStream;
  private alSegmento: (s: Segmento) => void;
  private alNivel: (nivel: number) => void;
  private umbral: number;

  constructor(stream: MediaStream, alSegmento: (s: Segmento) => void, alNivel: (nivel: number) => void, umbral = 0.012) {
    // Solo el audio: MediaRecorder no debe mezclar la pista de video de la pestaña.
    this.stream = new MediaStream(stream.getAudioTracks());
    this.alSegmento = alSegmento;
    this.alNivel = alNivel;
    this.umbral = umbral;
    this.analizador = this.contexto.createAnalyser();
    this.analizador.fftSize = 2048;
    this.muestras = new Float32Array(this.analizador.fftSize);
    // No se conecta a la salida: solo medimos el volumen, no lo volvemos a reproducir.
    this.contexto.createMediaStreamSource(this.stream).connect(this.analizador);
    void this.contexto.resume();
    this.empezar();
    this.intervalo = window.setInterval(() => this.revisar(), CADA_MS);
  }

  detener() {
    this.activo = false;
    window.clearInterval(this.intervalo);
    this.cortar(this.vozMs >= VOZ_MINIMA_MS);
    void this.contexto.close();
  }

  private empezar() {
    const partes: Blob[] = [];
    const grabadora = new MediaRecorder(this.stream, TIPO ? { mimeType: TIPO } : undefined);
    const segmento = { grabadora, inicio: Date.now(), enviar: false };
    grabadora.ondataavailable = (e) => {
      if (e.data.size) partes.push(e.data);
    };
    grabadora.onstop = () => {
      if (segmento.enviar) this.alSegmento({ blob: new Blob(partes, { type: grabadora.mimeType || 'audio/webm' }), inicio: segmento.inicio });
    };
    grabadora.start();
    this.actual = segmento;
    this.vozMs = 0;
  }

  private cortar(enviar: boolean) {
    if (!this.actual) return;
    this.actual.enviar = enviar;
    if (this.actual.grabadora.state !== 'inactive') this.actual.grabadora.stop();
    this.actual = null;
    if (this.activo) this.empezar();
  }

  private revisar() {
    if (!this.actual) return;
    this.analizador.getFloatTimeDomainData(this.muestras);
    let suma = 0;
    for (const m of this.muestras) suma += m * m;
    const nivel = Math.sqrt(suma / this.muestras.length);
    this.alNivel(nivel);

    const ahora = Date.now();
    if (nivel > this.umbral) {
      this.vozMs += CADA_MS;
      this.ultimaVoz = ahora;
    }
    const duracion = ahora - this.actual.inicio;
    const hablo = this.vozMs >= VOZ_MINIMA_MS;
    if (hablo && (ahora - this.ultimaVoz > SILENCIO_PARA_CORTAR_MS || duracion > MAXIMO_POR_SEGMENTO_MS)) this.cortar(true);
    // Si lleva rato sin voz, se descarta lo grabado para que el siguiente pedazo no cargue silencio.
    else if (!hablo && duracion > SIN_VOZ_REINICIAR_MS) this.cortar(false);
  }
}
