// Corrige con DeepSeek los segmentos de una transcripción automática (lo usan el notetaker y la prueba de Meetily).
// La key se lee de OPENROUTER_API_KEY / DEEPSEEK_API_KEY o de ~/.openrouter-key / ~/.deepseek-key. Nunca dentro del repo.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CONTEXTO = 8; // segmentos corregidos anteriores que ve DeepSeek

function leerArchivo(ruta) {
  try { return readFileSync(ruta, "utf8").trim(); } catch { return ""; }
}

export function leerKey() {
  const key = process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY
    || leerArchivo(join(homedir(), ".openrouter-key")) || leerArchivo(join(homedir(), ".deepseek-key"));
  if (!key) { console.error("Falta la key: ~/.openrouter-key o ~/.deepseek-key (o OPENROUTER_API_KEY)."); process.exit(1); }
  return key.trim();
}

export const glosario = leerArchivo(join(AQUI, "glosario.txt"));

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

// Devuelve corregir(segmento) con su propio historial. segmento = {hablante, texto, inicio}.
export function crearCorrector(key = leerKey()) {
  const openrouter = key.startsWith("sk-or-");
  const url = openrouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
  const modelo = openrouter ? "~deepseek/deepseek-flash-latest" : "deepseek-chat";
  const historial = [];

  async function pedir(segmento) {
    const previo = historial.slice(-CONTEXTO).map((s) => `${s.hablante}: ${s.texto}`).join("\n") || "(inicio de la llamada)";
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
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
    return JSON.parse(contenido.slice(contenido.indexOf("{"), contenido.lastIndexOf("}") + 1));
  }

  async function corregir(segmento) {
    let r;
    try {
      const json = await pedir(segmento);
      r = { hablante: json.hablante || segmento.hablante || "desconocido", texto: (json.texto || segmento.texto).trim() };
    } catch (e) {
      console.error(`  (no se pudo corregir: ${e.message}; se pasa tal cual)`);
      r = { hablante: segmento.hablante || "desconocido", texto: segmento.texto };
    }
    const final = { ...r, inicio: segmento.inicio, original: segmento.texto };
    historial.push(final);
    return final;
  }

  return { corregir, modelo };
}
