// Prueba de Vexa: manda un bot a una llamada de Google Meet o Teams e imprime la transcripción en vivo.
// Uso: node prototipos/vexa/escuchar.mjs "<liga de la llamada>" [idioma]
// La API key se lee de VEXA_API_KEY o de ~/.vexa-key (nunca dentro del repo).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = process.env.VEXA_API_BASE || "https://api.cloud.vexa.ai";
const CADA_MS = 2000;

function leerKey() {
  if (process.env.VEXA_API_KEY) return process.env.VEXA_API_KEY.trim();
  try {
    return readFileSync(join(homedir(), ".vexa-key"), "utf8").trim();
  } catch {
    console.error("Falta la API key: guárdala en ~/.vexa-key o en la variable VEXA_API_KEY.");
    process.exit(1);
  }
}

// Saca la plataforma y el id de la reunión de la liga.
function leerLiga(liga) {
  const meet = liga.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  if (meet) return { platform: "google_meet", native_meeting_id: meet[1].toLowerCase() };

  if (/teams\.(microsoft|live)\.com/i.test(liga)) {
    const url = new URL(liga);
    // Ligas nuevas: teams.microsoft.com/meet/<id>?p=<passcode>
    const id = url.pathname.match(/\/meet\/(\d+)/)?.[1] || url.pathname.split("/").filter(Boolean).pop();
    const bot = { platform: "teams", native_meeting_id: id, meeting_url: liga };
    if (url.searchParams.get("p")) bot.passcode = url.searchParams.get("p");
    return bot;
  }

  console.error("No reconozco la liga. Usa una de Google Meet (meet.google.com/abc-defg-hij) o de Teams.");
  process.exit(1);
}

async function api(metodo, ruta, cuerpo) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  if (!res.ok) throw new Error(`${metodo} ${ruta} → ${res.status}: ${texto.slice(0, 300)}`);
  return datos;
}

const [liga, idioma = "es"] = process.argv.slice(2);
if (!liga) {
  console.error('Uso: node prototipos/vexa/escuchar.mjs "<liga de Meet o Teams>" [idioma]');
  process.exit(1);
}
const KEY = leerKey();
const reunion = leerLiga(liga);
const ruta = `/bots/${reunion.platform}/${encodeURIComponent(reunion.native_meeting_id)}`;

console.log(`Mandando el bot a ${reunion.platform} ${reunion.native_meeting_id}...`);
try {
  await api("POST", "/bots", { ...reunion, bot_name: "Traductor (prueba)", language: idioma });
} catch (e) {
  console.error("No se pudo mandar el bot: " + e.message);
  process.exit(1);
}
console.log("Bot enviado. Admítelo en la llamada si queda en la sala de espera. Ctrl+C para sacarlo.\n");

let saliendo = false;
process.on("SIGINT", async () => {
  if (saliendo) process.exit(1);
  saliendo = true;
  console.log("\nSacando el bot de la llamada...");
  try { await api("DELETE", ruta); console.log("Listo."); }
  catch (e) { console.error(e.message); }
  process.exit(0);
});

// Los segmentos pueden llegar como borrador y corregirse después: se vuelven a imprimir si cambian.
const vistos = new Map();
let avisoEspera = false;
while (!saliendo) {
  try {
    const datos = await api("GET", `/transcripts/${reunion.platform}/${encodeURIComponent(reunion.native_meeting_id)}`);
    const segmentos = Array.isArray(datos) ? datos : datos.segments || [];
    if (!segmentos.length && !avisoEspera) {
      console.log("(esperando a que alguien hable...)");
      avisoEspera = true;
    }
    for (const s of segmentos) {
      const clave = s.absolute_start_time || s.start_time || s.start;
      const texto = (s.text || "").trim();
      if (!texto || vistos.get(clave) === texto) continue;
      const corregido = vistos.has(clave);
      vistos.set(clave, texto);
      const hora = s.absolute_start_time ? new Date(s.absolute_start_time).toLocaleTimeString("es-MX") : "";
      console.log(`${corregido ? "  ↳ " : ""}[${hora}] ${s.speaker || "?"}: ${texto}`);
    }
  } catch (e) {
    // 404 mientras el bot todavía no entra a la llamada; lo demás se muestra.
    if (!/→ 404/.test(e.message)) console.error(e.message);
  }
  await new Promise((r) => setTimeout(r, CADA_MS));
}
