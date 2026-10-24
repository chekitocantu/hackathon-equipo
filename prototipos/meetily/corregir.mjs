// Prueba: lee la transcripción de Meetily en vivo y la corrige con DeepSeek.
// Uso:
//   node prototipos/meetily/corregir.mjs                    sigue la base de Meetily (solo segmentos nuevos)
//   node prototipos/meetily/corregir.mjs --desde-inicio     también corrige lo que ya estaba guardado
//   node prototipos/meetily/corregir.mjs --archivo <txt>    corrige un archivo con líneas "hablante|texto" (sin Meetily)
// Salida: cada segmento corregido en la terminal y en prototipos/meetily/salida/<hora>.jsonl,
// con el formato de notas/notetaker.md: {"hablante","texto","inicio"} (+ "original" para comparar).
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { crearCorrector } from "../notetaker/corrector.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = join(process.env.APPDATA || "", "com.meetily.ai", "meeting_minutes.sqlite");
const CADA_MS = 2000;
const { corregir, modelo } = crearCorrector();

mkdirSync(join(AQUI, "salida"), { recursive: true });
const SALIDA = join(AQUI, "salida", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".jsonl");

async function procesar(segmento) {
  const t0 = Date.now();
  const r = await corregir(segmento);
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
  console.log(`Corrigiendo ${lineas.length} líneas con ${modelo}...\n`);
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
  console.log(`Siguiendo la transcripción de Meetily (${modelo}). Empieza a grabar en Meetily. Ctrl+C para salir.\n`);
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
