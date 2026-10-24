// Graba el micrófono (y, si se pide, el audio de la llamada por separado), corta el audio en las pausas
// y manda cada pedazo al servidor, que lo transcribe y lo corrige. Cada fuente es un hablante:
// micrófono = vendedor, audio de la llamada = cliente. Con solo micrófono, DeepSeek adivina quién habló.
const $ = (id) => document.getElementById(id);

const SILENCIO_MS = 550;   // pausa que cierra una frase
const MIN_MS = 1200;       // no mandar pedazos más cortos que esto
const MAX_MS = 12000;      // cortar aunque no haya pausa
const TIPO = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
  .find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";

let fuentes = [];
let contexto = null;
let lineas = [];
let orden = 0;

function estado(texto, grabando = false) {
  $("estado").textContent = texto;
  $("estado").classList.toggle("grabando", grabando);
}

// Una fuente de audio con su propio detector de voz y su propia grabadora.
function crearFuente(stream, hablante, medidor) {
  const analizador = contexto.createAnalyser();
  analizador.fftSize = 1024;
  contexto.createMediaStreamSource(stream).connect(analizador);
  const muestras = new Float32Array(analizador.fftSize);

  const f = { stream, hablante, grabadora: null, seg: null, ultimaVoz: 0, ruido: 0.004, timer: null };

  // Cada pedazo lleva su propia marca de "hubo voz": el onstop llega después de que ya empezó el siguiente.
  function empezar() {
    const grabadora = new MediaRecorder(stream, TIPO ? { mimeType: TIPO } : undefined);
    const seg = { voz: false, inicio: performance.now(), hora: new Date() };
    const partes = [];
    grabadora.ondataavailable = (e) => e.data.size && partes.push(e.data);
    grabadora.onstop = () => {
      if (seg.voz && partes.length) enviar(new Blob(partes, { type: grabadora.mimeType || TIPO }), hablante, seg.hora);
    };
    grabadora.start();
    f.grabadora = grabadora;
    f.seg = seg;
  }

  function cortar() {
    f.grabadora.stop();
    empezar();
  }

  f.timer = setInterval(() => {
    analizador.getFloatTimeDomainData(muestras);
    let suma = 0;
    for (const m of muestras) suma += m * m;
    const nivel = Math.sqrt(suma / muestras.length);
    // El umbral se adapta al ruido de fondo del cuarto.
    if (nivel < f.ruido * 2) f.ruido = f.ruido * 0.95 + nivel * 0.05;
    const umbral = Math.max(0.01, f.ruido * 3);
    medidor.style.width = Math.min(100, nivel * 400) + "%";

    const ahora = performance.now();
    if (nivel > umbral) { f.ultimaVoz = ahora; f.seg.voz = true; }
    const dura = ahora - f.seg.inicio;
    const pausa = f.seg.voz && ahora - f.ultimaVoz > SILENCIO_MS && dura > MIN_MS;
    if (pausa || dura > MAX_MS) cortar(); // si fue puro silencio, el onstop no lo manda
  }, 50);

  empezar();
  return f;
}

function nuevaLinea(hablante, inicio) {
  const art = document.createElement("article");
  art.className = `segmento ${hablante || "desconocido"} pendiente`;
  art.innerHTML = `<div class="meta"><span class="hablante"></span><span class="hora"></span><span class="tiempos"></span></div>
    <p class="texto">…</p><p class="original"></p>`;
  art.querySelector(".hablante").textContent = hablante || "¿quién?";
  art.querySelector(".hora").textContent = inicio.toLocaleTimeString("es-MX");
  art.dataset.orden = orden++;
  $("transcripcion").append(art);
  art.scrollIntoView({ behavior: "smooth", block: "end" });
  return art;
}

async function enviar(blob, hablante, inicio) {
  const art = nuevaLinea(hablante, inicio);
  try {
    const q = new URLSearchParams({ hablante, inicio: inicio.toISOString() });
    const res = await fetch(`/api/segmento?${q}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
    if (!res.ok) throw new Error((await res.json()).error || res.status);
    // El servidor manda dos líneas: lo que entendió (se muestra ya) y luego la versión corregida.
    let r = null;
    const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let resto = "";
    while (true) {
      const { value, done } = await lector.read();
      if (done) break;
      resto += value;
      const partes = resto.split("\n");
      resto = partes.pop();
      for (const linea of partes.filter(Boolean)) {
        const d = JSON.parse(linea);
        if (d.error) throw new Error(d.error);
        if (d.vacio) return art.remove();
        if (d.crudo) {
          art.querySelector(".texto").textContent = d.texto;
          art.querySelector(".tiempos").textContent = `voz ${d.seg_transcripcion.toFixed(1)}s · corrigiendo…`;
        } else r = d;
      }
    }
    if (!r) throw new Error("respuesta incompleta");
    art.className = `segmento ${r.hablante}`;
    art.querySelector(".hablante").textContent = r.hablante;
    art.querySelector(".texto").textContent = r.texto;
    art.querySelector(".original").textContent = r.original === r.texto ? "" : `Entendió: ${r.original}`;
    art.querySelector(".tiempos").textContent = `voz ${r.seg_transcripcion.toFixed(1)}s · corrección ${r.seg_correccion.toFixed(1)}s`;
    lineas[art.dataset.orden] = { hablante: r.hablante, texto: r.texto, inicio: r.inicio, original: r.original };
    actualizarDescarga();
  } catch (e) {
    art.className = "segmento desconocido";
    art.querySelector(".texto").textContent = `Error: ${e.message}`;
  }
}

function actualizarDescarga() {
  const jsonl = lineas.filter(Boolean).map((l) => JSON.stringify(l)).join("\n");
  const a = $("descargar");
  if (a.href.startsWith("blob:")) URL.revokeObjectURL(a.href);
  a.href = URL.createObjectURL(new Blob([jsonl], { type: "application/x-ndjson" }));
}

async function arrancar(conLlamada) {
  try {
    estado("Pidiendo permisos…");
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    let llamada = null;
    if (conLlamada) {
      // Chrome/Edge/Brave: elegir "Pantalla completa" (o la pestaña de Meet/Teams) y activar "Compartir audio".
      const pantalla = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (!pantalla.getAudioTracks().length) {
        pantalla.getTracks().forEach((t) => t.stop());
        mic.getTracks().forEach((t) => t.stop());
        return estado("No se compartió audio: vuelve a intentar y marca «Compartir audio».");
      }
      llamada = pantalla;
    }
    await fetch("/api/sesion", { method: "POST" });
    contexto = new AudioContext();
    fuentes = [crearFuente(mic, llamada ? "vendedor" : "", $("nivel-mic"))];
    if (llamada) {
      fuentes.push(crearFuente(new MediaStream(llamada.getAudioTracks()), "cliente", $("nivel-llamada")));
      fuentes[1].extra = llamada;
    }
    $("btn-mic").disabled = $("btn-llamada").disabled = true;
    $("btn-parar").disabled = false;
    estado(llamada ? "Escuchando micrófono y llamada" : "Escuchando micrófono", true);
  } catch (e) {
    estado(`No se pudo empezar: ${e.message}`);
  }
}

function parar() {
  for (const f of fuentes) {
    clearInterval(f.timer);
    if (f.grabadora?.state === "recording") f.grabadora.stop(); // manda lo último si hubo voz
    f.stream.getTracks().forEach((t) => t.stop());
    f.extra?.getTracks().forEach((t) => t.stop());
  }
  fuentes = [];
  contexto?.close();
  $("nivel-mic").style.width = $("nivel-llamada").style.width = "0";
  $("btn-mic").disabled = $("btn-llamada").disabled = false;
  $("btn-parar").disabled = true;
  estado("Detenido");
}

$("btn-mic").onclick = () => arrancar(false);
$("btn-llamada").onclick = () => arrancar(true);
$("btn-parar").onclick = parar;
$("ver-original").onchange = (e) => document.body.classList.toggle("sin-original", !e.target.checked);
if (!TIPO) estado("Este navegador no puede grabar audio. Usa Chrome, Edge o Brave.");
