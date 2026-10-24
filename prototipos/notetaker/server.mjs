// Notetaker del Traductor: sirve la página y recibe pedazos de audio, los transcribe con OpenRouter
// (idioma español) y los corrige con DeepSeek, en orden. Al terminar recibe la grabación completa,
// separa las voces (ElevenLabs Scribe) y DeepSeek le pone nombre a cada una.
// Uso: node prototipos/notetaker/server.mjs   → abre http://localhost:5180
// Variables opcionales: PUERTO, MODELO_STT (en vivo, default openai/gpt-4o-mini-transcribe),
// MODELO_VOCES (al final, default elevenlabs/scribe-v2).
import { createServer } from "node:http";
import { readFile, mkdir, appendFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { leerKey, crearCorrector, nombrarVoces, glosario } from "./corrector.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(AQUI, "public");
const PUERTO = Number(process.env.PUERTO || 5180);
const MODELO_STT = process.env.MODELO_STT || "openai/gpt-4o-mini-transcribe";
const MODELO_VOCES = process.env.MODELO_VOCES || "elevenlabs/scribe-v2";
const API_STT = "https://openrouter.ai/api/v1/audio/transcriptions";
const KEY = leerKey();
if (!KEY.startsWith("sk-or-")) {
  console.error("La transcripción va por OpenRouter: hace falta una key sk-or-... en ~/.openrouter-key o ~/.deepseek-key.");
  process.exit(1);
}

// Pista para el motor de voz: las siglas del glosario, para que las escriba bien desde el inicio.
const PISTA = "Llamada de ventas de Alestra en español de México. Términos: "
  + glosario.split("\n").map((l) => l.split(" — ")[0]).join(", ").slice(0, 600);

// Cada pestaña que empieza a grabar es una sesión con su propio corrector, cola y archivo de salida.
const sesiones = new Map();

async function nuevaSesion(asistentes) {
  await mkdir(join(AQUI, "salida"), { recursive: true });
  const id = randomUUID();
  const s = {
    id,
    asistentes,
    corrector: crearCorrector(KEY, asistentes),
    cola: Promise.resolve(), // las correcciones van en orden para que DeepSeek vea el contexto correcto
    archivo: join(AQUI, "salida", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "-" + id.slice(0, 4)),
  };
  sesiones.set(id, s);
  if (asistentes) await writeFile(s.archivo + "-asistentes.txt", asistentes);
  return s;
}

function extension(tipo) {
  return tipo.includes("ogg") ? "ogg" : tipo.includes("mp4") ? "mp4" : tipo.includes("wav") ? "wav" : "webm";
}

async function transcribir(audio, tipo) {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: tipo }), `segmento.${extension(tipo)}`);
  form.append("model", MODELO_STT);
  form.append("language", "es");
  form.append("prompt", PISTA);
  const res = await fetch(API_STT, { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form });
  if (!res.ok) throw new Error(`Transcripción ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()).text || "").trim();
}

// Grabación completa → turnos [{voz, inicio, texto}] agrupando las palabras seguidas de la misma voz.
async function separarVoces(audio, tipo) {
  const res = await fetch(API_STT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELO_VOCES,
      language: "es",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      input_audio: { data: audio.toString("base64"), format: extension(tipo) },
      provider: { options: { elevenlabs: { diarize: true }, deepgram: { diarize: true } } },
    }),
  });
  if (!res.ok) throw new Error(`Separación de voces ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const datos = await res.json();
  const turnos = [];
  for (const p of datos.words || []) {
    const voz = p.speaker ?? 0;
    const ultimo = turnos.at(-1);
    if (ultimo && ultimo.voz === voz) ultimo.texto += " " + p.word.trim();
    else turnos.push({ voz, inicio: p.start ?? 0, texto: p.word.trim() });
  }
  if (!turnos.length && datos.text) turnos.push({ voz: 0, inicio: 0, texto: datos.text.trim() });
  return turnos;
}

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    const partes = [];
    req.on("data", (p) => partes.push(p));
    req.on("end", () => ok(Buffer.concat(partes)));
    req.on("error", mal);
  });
}

function json(res, codigo, datos) {
  res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(datos));
}

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "POST" && url.pathname === "/api/sesion") {
      const cuerpo = (await leerCuerpo(req)).toString("utf8");
      const asistentes = (cuerpo ? JSON.parse(cuerpo).asistentes || "" : "").trim().slice(0, 2000);
      const s = await nuevaSesion(asistentes);
      return json(res, 200, { sesion: s.id, modelo_stt: MODELO_STT, modelo_voces: MODELO_VOCES, modelo_correccion: s.corrector.modelo });
    }

    const s = sesiones.get(url.searchParams.get("sesion"));
    if (req.method === "POST" && url.pathname.startsWith("/api/") && !s) {
      return json(res, 400, { error: "Sesión desconocida: recarga la página y vuelve a empezar." });
    }

    if (req.method === "POST" && url.pathname === "/api/segmento") {
      const audio = await leerCuerpo(req);
      const hablante = url.searchParams.get("hablante") || "";
      const inicio = url.searchParams.get("inicio") || new Date().toISOString();
      const t0 = Date.now();
      const texto = await transcribir(audio, req.headers["content-type"] || "audio/webm");
      const segTranscripcion = (Date.now() - t0) / 1000;
      // Whisper inventa frases típicas cuando el pedazo es casi silencio; se descartan.
      if (!texto || /^(gracias|subtítulos|suscríbete|amara\.org)/i.test(texto) && texto.length < 40) {
        return json(res, 200, { vacio: true });
      }
      // Respuesta en dos líneas (NDJSON): primero lo que entendió, luego la versión corregida.
      res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
      res.write(JSON.stringify({ crudo: true, texto, hablante, seg_transcripcion: segTranscripcion }) + "\n");
      const turno = s.cola.then(async () => {
        const t1 = Date.now();
        const r = await s.corrector.corregir({ hablante, texto, inicio });
        return { ...r, seg_transcripcion: segTranscripcion, seg_correccion: (Date.now() - t1) / 1000 };
      });
      s.cola = turno.catch(() => {});
      const r = await turno;
      await appendFile(s.archivo + "-envivo.jsonl",
        JSON.stringify({ hablante: r.hablante, rol: r.rol, texto: r.texto, inicio: r.inicio, original: r.original }) + "\n");
      console.log(`${r.hablante.padEnd(18)} ${r.texto}  (${r.seg_transcripcion.toFixed(1)}s + ${r.seg_correccion.toFixed(1)}s)`);
      return res.end(JSON.stringify(r) + "\n");
    }

    if (req.method === "POST" && url.pathname === "/api/final") {
      const audio = await leerCuerpo(req);
      const tipo = req.headers["content-type"] || "audio/webm";
      const comienzo = new Date(url.searchParams.get("comienzo") || Date.now());
      const t0 = Date.now();
      const turnos = await separarVoces(audio, tipo);
      const segVoces = (Date.now() - t0) / 1000;
      const t1 = Date.now();
      const final = await nombrarVoces(turnos, s.asistentes, KEY);
      const segNombres = (Date.now() - t1) / 1000;
      // Mismo formato que el modo en vivo (notas/notetaker.md): inicio en ISO, a partir de la hora en que empezó.
      const lineas = final.turnos.map((t) => ({
        hablante: t.hablante,
        rol: t.rol,
        texto: t.texto,
        inicio: new Date(comienzo.getTime() + (Number(t.inicio) || 0) * 1000).toISOString(),
      }));
      await writeFile(s.archivo + "-final.jsonl", lineas.map((l) => JSON.stringify(l)).join("\n") + "\n");
      await writeFile(s.archivo + "-final.webm", audio);
      console.log(`Final: ${turnos.length} turnos, ${Object.keys(final.voces).length} voces (${segVoces.toFixed(1)}s + ${segNombres.toFixed(1)}s)`);
      return json(res, 200, { voces: final.voces, turnos: lineas, seg_voces: segVoces, seg_nombres: segNombres });
    }

    if (req.method === "GET") {
      const ruta = normalize(join(PUBLICO, url.pathname === "/" ? "index.html" : url.pathname));
      if (!ruta.startsWith(PUBLICO)) return json(res, 403, { error: "fuera de public" });
      const contenido = await readFile(ruta);
      res.writeHead(200, { "Content-Type": TIPOS[extname(ruta)] || "application/octet-stream", "Cache-Control": "no-store" });
      return res.end(contenido);
    }
    json(res, 404, { error: "no existe" });
  } catch (e) {
    if (e.code === "ENOENT") return json(res, 404, { error: "no existe" });
    console.error(e.message);
    if (res.headersSent) return res.end(JSON.stringify({ error: e.message }) + "\n");
    json(res, 500, { error: e.message });
  }
}).listen(PUERTO, () => {
  console.log(`Notetaker listo en http://localhost:${PUERTO}  (en vivo: ${MODELO_STT}, voces al final: ${MODELO_VOCES})`);
});
