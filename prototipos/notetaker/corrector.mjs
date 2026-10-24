// Corrige con DeepSeek los segmentos de una transcripción automática (lo usan el notetaker y la prueba de Meetily),
// y al final de la reunión le pone nombre a cada voz que separó el modelo de transcripción.
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

const CONTEXTO_ALESTRA = `una reunión de ventas en español (México) de Alestra, empresa de telecomunicaciones, TI y ciberseguridad.
El motor de voz se equivoca en términos técnicos, siglas y números.`;

const REGLAS_TEXTO = `- Corrige solo errores de reconocimiento de voz, ortografía y puntuación. Escribe siglas como se escriben (SD-WAN, SLA, Mbps).
- No agregues información, no resumas, no cambies el sentido. Si no estás seguro de una palabra, déjala como está.
- Números en cifras cuando sean cantidades (40 sucursales, 100 Mbps, 99.9%).`;

function seccionAsistentes(asistentes) {
  return asistentes
    ? `\nAsistentes que anotó el vendedor (nombre – área):\n${asistentes}\nLos que no son de Alestra son del cliente.`
    : "";
}

function instruccionesEnVivo(asistentes) {
  return `Corriges, segmento por segmento, la transcripción en vivo de ${CONTEXTO_ALESTRA}
Reglas:
${REGLAS_TEXTO}
- "rol": "vendedor" (es de Alestra, ofrece y pregunta) o "cliente" (pide, tiene el problema). Si ya viene, respétalo
  salvo que sea claramente al revés; si no se puede saber, "desconocido".
- "nombre": quién habló, con el formato "Nombre (Área)", solo si es claro por lo que dice, porque se presentó o porque
  le hablan por su nombre justo antes. Si no es claro, "". No adivines entre dos personas del mismo lado.
Responde solo JSON: {"texto": "...", "rol": "vendedor|cliente|desconocido", "nombre": "..."}
${seccionAsistentes(asistentes)}
${glosario ? "\nGlosario de términos que suelen aparecer:\n" + glosario : ""}`;
}

function instruccionesFinal(asistentes) {
  return `Recibes la transcripción completa de ${CONTEXTO_ALESTRA}
El motor separó las voces y numeró a cada una (voz 0, voz 1…). Tu trabajo es dejar la versión final:
${REGLAS_TEXTO}
- Ponle a cada voz el nombre de quien habla, con el formato "Nombre (Área)", usando la lista de asistentes, cuando alguien
  se presenta o cuando le hablan por su nombre. Si no se puede saber, usa "Vendedor (Alestra)", "Cliente 1", "Cliente 2"…
- La separación de voces es buena pero no perfecta: si un turno junta a dos personas y el contenido lo deja claro
  (por ejemplo, el vendedor pregunta y alguien se presenta en el mismo turno), divídelo. Si no es claro, no lo toques.
- "rol" de cada turno: "vendedor" o "cliente".
- No cambies el orden ni quites turnos. Conserva el "inicio" (segundos) de cada turno; si divides uno, el segundo pedazo
  lleva el mismo inicio.
Responde solo JSON: {"voces": {"0": "Nombre (Área)", ...}, "turnos": [{"inicio": 0.0, "hablante": "Nombre (Área)", "rol": "vendedor|cliente", "texto": "..."}]}
${seccionAsistentes(asistentes)}
${glosario ? "\nGlosario de términos que suelen aparecer:\n" + glosario : ""}`;
}

function crearCliente(key) {
  const openrouter = key.startsWith("sk-or-");
  const url = openrouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
  const modelo = openrouter ? "~deepseek/deepseek-flash-latest" : "deepseek-chat";
  async function pedirJSON(sistema, usuario) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const contenido = (await res.json()).choices[0].message.content;
    return JSON.parse(contenido.slice(contenido.indexOf("{"), contenido.lastIndexOf("}") + 1));
  }
  return { pedirJSON, modelo };
}

// Devuelve corregir(segmento) con su propio historial. segmento = {hablante, texto, inicio}, donde hablante es un rol
// ("vendedor", "cliente") o "". El resultado trae rol, hablante (nombre si se sabe, si no el rol), texto e inicio.
export function crearCorrector(key = leerKey(), asistentes = "") {
  const { pedirJSON, modelo } = crearCliente(key);
  const sistema = instruccionesEnVivo(asistentes);
  const historial = [];

  async function corregir(segmento) {
    let r;
    try {
      const previo = historial.slice(-CONTEXTO).map((s) => `${s.hablante}: ${s.texto}`).join("\n") || "(inicio de la reunión)";
      const json = await pedirJSON(sistema,
        `Lo anterior en la reunión (ya corregido):\n${previo}\n\nSegmento a corregir (rol: ${segmento.hablante || "?"}):\n${segmento.texto}`);
      const rol = ["vendedor", "cliente"].includes(json.rol) ? json.rol : segmento.hablante || "desconocido";
      r = { rol, hablante: json.nombre?.trim() || rol, texto: (json.texto || segmento.texto).trim() };
    } catch (e) {
      console.error(`  (no se pudo corregir: ${e.message}; se pasa tal cual)`);
      const rol = segmento.hablante || "desconocido";
      r = { rol, hablante: rol, texto: segmento.texto };
    }
    const final = { ...r, inicio: segmento.inicio, original: segmento.texto };
    historial.push(final);
    return final;
  }

  return { corregir, modelo };
}

// turnos = [{voz, inicio (s), texto}] del modelo que separa voces. Devuelve {voces, turnos} con nombre y rol.
export async function nombrarVoces(turnos, asistentes = "", key = leerKey()) {
  const { pedirJSON } = crearCliente(key);
  const texto = turnos.map((t) => `[voz ${t.voz}] (${t.inicio.toFixed(1)} s) ${t.texto}`).join("\n");
  const json = await pedirJSON(instruccionesFinal(asistentes), texto);
  if (!Array.isArray(json.turnos) || !json.turnos.length) throw new Error("DeepSeek no regresó turnos");
  return { voces: json.voces || {}, turnos: json.turnos };
}
