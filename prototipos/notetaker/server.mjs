// Notetaker del Traductor: sirve la página y recibe pedazos de audio, los transcribe con OpenRouter
// (Whisper / GPT transcribe, idioma español) y los corrige con DeepSeek, en orden.
// Uso: node prototipos/notetaker/server.mjs   → abre http://localhost:5180
// Variables opcionales: PUERTO, MODELO_STT (default openai/gpt-4o-mini-transcribe).
import { createServer } from "node:http";
import { readFile, mkdir, appendFile } from "node:fs/promises";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { leerKey, crearCorrector, glosario } from "./corrector.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(AQUI, "public");
const PUERTO = Number(process.env.PUERTO || 5180);
const MODELO_STT = process.env.MODELO_STT || "openai/gpt-4o-mini-transcribe";
const KEY = leerKey();
if (!KEY.startsWith("sk-or-")) {
  console.error("La transcripción va por OpenRouter: hace falta una key sk-or-... en ~/.openrouter-key o ~/.deepseek-key.");
  process.exit(1);
}

// Pista para el motor de voz: las siglas del glosario, para que las escriba bien desde el inicio.
const PISTA = "Llamada de ventas de Alestra en español de México. Términos: "
  + glosario.split("\n").map((l) => l.split(" — ")[0]).join(", ").slice(0, 600);

let corrector = crearCorrector(KEY);
let cola = Promise.resolve(); // las correcciones van en orden para que DeepSeek vea el contexto correcto
let salida = "";

async function nuevaSesion() {
  corrector = crearCorrector(KEY);
  cola = Promise.resolve();
  await mkdir(join(AQUI, "salida"), { recursive: true });
  salida = join(AQUI, "salida", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".jsonl");
}

async function transcribir(audio, tipo) {
  const form = new FormData();
  const ext = tipo.includes("ogg") ? "ogg" : tipo.includes("mp4") ? "mp4" : tipo.includes("wav") ? "wav" : "webm";
  form.append("file", new Blob([audio], { type: tipo }), `segmento.${ext}`);
  form.append("model", MODELO_STT);
  form.append("language", "es");
  form.append("prompt", PISTA);
  const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form,
  });
  if (!res.ok) throw new Error(`Transcripción ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()).text || "").trim();
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
      await nuevaSesion();
      return json(res, 200, { ok: true, modelo_stt: MODELO_STT, modelo_correccion: corrector.modelo });
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
      const turno = cola.then(async () => {
        const t1 = Date.now();
        const r = await corrector.corregir({ hablante, texto, inicio });
        return { ...r, seg_transcripcion: segTranscripcion, seg_correccion: (Date.now() - t1) / 1000 };
      });
      cola = turno.catch(() => {});
      const r = await turno;
      if (!salida) await nuevaSesion();
      await appendFile(salida, JSON.stringify({ hablante: r.hablante, texto: r.texto, inicio: r.inicio, original: r.original }) + "\n");
      console.log(`${r.hablante.padEnd(11)} ${r.texto}  (${r.seg_transcripcion.toFixed(1)}s + ${r.seg_correccion.toFixed(1)}s)`);
      return res.end(JSON.stringify(r) + "\n");
    }

    if (req.method === "GET") {
      const ruta = normalize(join(PUBLICO, url.pathname === "/" ? "index.html" : url.pathname));
      if (!ruta.startsWith(PUBLICO)) return json(res, 403, { error: "fuera de public" });
      const contenido = await readFile(ruta);
      res.writeHead(200, { "Content-Type": TIPOS[extname(ruta)] || "application/octet-stream" });
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
  console.log(`Notetaker listo en http://localhost:${PUERTO}  (voz: ${MODELO_STT}, corrección: ${corrector.modelo})`);
});
