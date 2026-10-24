// Prueba: lee la transcripción de Meetily en vivo y la corrige con DeepSeek.
// Uso:
//   node prototipos/meetily/corregir.mjs                    sigue la base de Meetily (solo segmentos nuevos)
//   node prototipos/meetily/corregir.mjs --desde-inicio     también corrige lo que ya estaba guardado
//   node prototipos/meetily/corregir.mjs --archivo <txt>    corrige un archivo con líneas "hablante|texto" (sin Meetily)
// Salida: cada segmento corregido en la terminal y en prototipos/meetily/salida/<hora>.jsonl,
// con el formato de notas/notetaker.md: {"hablante","texto","inicio"} (+ "original" para comparar).
// La key se lee de DEEPSEEK_API_KEY o de ~/.deepseek-key (DeepSeek u OpenRouter "sk-or-..."). Nunca dentro del repo.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = join(process.env.APPDATA || "", "com.meetily.ai", "meeting_minutes.sqlite");
const CADA_MS = 2000;
const CONTEXTO = 8; // segmentos corregidos anteriores que ve DeepSeek

function leerKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim();
  try { return readFileSync(join(homedir(), ".deepseek-key"), "utf8").trim(); }
  catch { console.error("Falta la key: ~/.deepseek-key o DEEPSEEK_API_KEY."); process.exit(1); }
}
const KEY = leerKey();
const OPENROUTER = KEY.startsWith("sk-or-");
const URL_API = OPENROUTER ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
const MODELO = OPENROUTER ? "~deepseek/deepseek-flash-latest" : "deepseek-chat";

let glosario = "";
try { glosario = readFileSync(join(AQUI, "glosario.txt"), "utf8").trim(); } catch {}

const INSTRUCCIONES = `Corriges la transcripción automática de una llamada de ventas en español (México) de Alestra,
empresa de telecomunicaciones, TI y ciberseguridad. El motor de voz se equivoca en términos técnicos, siglas y números.
Reglas:
- Corrige solo errores de reconocimiento de voz, ortografía y puntuación. Escribe siglas como se escriben (SD-WAN, SLA, Mbps).
- No agregues información, no resumas, no cambies el sentido. Si no estás seguro de una palabra, déjala como está.
- Números en cifras cuando sean cantidades (40 sucursales, 100 Mbps, 99.9%).
- "hablante": "vendedor" (es de Alestra, ofrece y pregunta) o "cliente" (pide, tiene el problema). Si ya viene, respétalo
  salvo que sea claramente al revés; si no se puede saber, "desconocido".
Responde solo JSON: {"texto": "...", "hablante": "vendedor|cliente|desconocido"}
${glosario ? "\nGlosario de términos que suelen aparecer:\n" + glosario : ""}`;

const historial = [];

async function corregir(segmento) {
  const previo = historial.slice(-CONTEXTO).map((s) => `${s.hablante}: ${s.texto}`).join("\n") || "(inicio de la llamada)";
  const res = await fetch(URL_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELO,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INSTRUCCIONES },
        { role: "user", content: `Lo anterior en la llamada (ya corregido):\n${previo}\n\nSegmento a corregir (hablante: ${segmento.hablante || "?"}):\n${segmento.texto}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const contenido = (await res.json()).choices[0].message.content;
  const json = JSON.parse(contenido.slice(contenido.indexOf("{"), contenido.lastIndexOf("}") + 1));
  return {
    hablante: json.hablante || segmento.hablante || "desconocido",
    texto: (json.texto || segmento.texto).trim(),
    inicio: segmento.inicio,
    original: segmento.texto,
  };
}

mkdirSync(join(AQUI, "salida"), { recursive: true });
const SALIDA = join(AQUI, "salida", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".jsonl");

async function procesar(segmento) {
  const t0 = Date.now();
  let r;
  try { r = await corregir(segmento); }
  catch (e) {
    console.error(`  (no se pudo corregir: ${e.message}; se pasa tal cual)`);
    r = { hablante: segmento.hablante || "desconocido", texto: segmento.texto, inicio: segmento.inicio, original: segmento.texto };
  }
  historial.push(r);
  appendFileSync(SALIDA, JSON.stringify(r) + "\n");
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\x1b[2m  antes: ${r.original}\x1b[0m`);
  console.log(`  ${r.hablante.padEnd(11)} ${r.texto}  \x1b[2m(${seg}s)\x1b[0m\n`);
}

// Meetily guarda el micrófono y el audio de la compu juntos; si algún día llena "speaker", lo traducimos a rol.
function rolDe(speaker) {
  if (!speaker) return "";
  if (/mic|user|you|yo/i.test(speaker)) return "vendedor";
  if (/system|speaker|other|remote/i.test(speaker)) return "cliente";
  return speaker;
}

const args = process.argv.slice(2);
const iArchivo = args.indexOf("--archivo");

if (iArchivo >= 0) {
  const lineas = readFileSync(args[iArchivo + 1], "utf8").split(/\r?\n/).filter((l) => l.trim());
  console.log(`Corrigiendo ${lineas.length} líneas con ${MODELO}...\n`);
  for (const l of lineas) {
    const [hablante, ...resto] = l.includes("|") ? l.split("|") : ["", l];
    await procesar({ hablante: hablante.trim(), texto: resto.join("|").trim(), inicio: new Date().toISOString() });
  }
} else {
  let db;
  try { db = new DatabaseSync(BASE, { readOnly: true }); }
  catch { console.error(`No encuentro la base de Meetily en ${BASE}. ¿Está instalado y ya lo abriste una vez?`); process.exit(1); }
  const consulta = db.prepare("select rowid r, transcript, speaker, timestamp from transcripts where rowid > ? order by rowid");
  let ultimo = args.includes("--desde-inicio") ? 0 : db.prepare("select coalesce(max(rowid), 0) m from transcripts").get().m;
  console.log(`Siguiendo la transcripción de Meetily (${MODELO}). Empieza a grabar en Meetily. Ctrl+C para salir.\n`);
  while (true) {
    for (const t of consulta.all(ultimo)) {
      ultimo = t.r;
      if (!t.transcript?.trim()) continue;
      await procesar({ hablante: rolDe(t.speaker), texto: t.transcript.trim(), inicio: t.timestamp });
    }
    await new Promise((r) => setTimeout(r, CADA_MS));
  }
}
console.log(`Guardado en ${SALIDA}`);
