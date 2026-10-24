// Adaptador del notetaker (Vexa, ver notas/notetaker.md). Es el único lugar que conoce la API de Vexa:
// si cambia algo de su respuesta, se ajusta aquí y la pantalla de "Enlaza tu llamada" no se entera.
// Docs: https://docs.vexa.ai — mandar bot (POST /bots), leer frases (GET /transcripts/...), sacarlo (DELETE /bots/...).

export interface ConfigVexa {
  apiKey?: string;
  url: string;
}

/** Formato acordado en notas/notetaker.md, más el rol ya resuelto. */
export interface SegmentoNotetaker {
  hablante: string;
  rol: 'Vendedor' | 'Cliente';
  texto: string;
  /** Segundos desde que el bot empezó a escuchar. */
  inicio: number;
  /** false mientras Vexa todavía puede corregir la frase. */
  confirmado: boolean;
}

const PLATAFORMA = 'google_meet';

/** Saca el código de la reunión (abc-defg-hij) de un link de Meet o del código solo. */
export function codigoDeMeet(link: string) {
  return /([a-z]{3}-[a-z]{4}-[a-z]{3})/i.exec(link)?.[1]?.toLowerCase() ?? null;
}

export async function enviarBot(config: ConfigVexa, codigo: string) {
  await llamar(config, 'POST', '/bots', {
    platform: PLATAFORMA,
    native_meeting_id: codigo,
    bot_name: 'Asistente de ventas',
    language: 'es',
  });
}

export async function sacarBot(config: ConfigVexa, codigo: string) {
  await llamar(config, 'DELETE', `/bots/${PLATAFORMA}/${codigo}`);
}

/** Estado del bot tal como lo da Vexa (ej. "awaiting_admission", "active"), o null si no se pudo saber. */
export async function estadoBot(config: ConfigVexa, codigo: string): Promise<string | null> {
  try {
    const json = await llamar(config, 'GET', '/bots/status');
    const bots: Record<string, unknown>[] = Array.isArray(json) ? json : (json.running_bots ?? json.bots ?? []);
    const bot = bots.find((b) => b.native_meeting_id === codigo || String(b.meeting_url ?? '').includes(codigo));
    const estado = bot?.status ?? bot?.meeting_status ?? bot?.state;
    return typeof estado === 'string' ? estado : null;
  } catch {
    return null;
  }
}

export async function leerSegmentos(config: ConfigVexa, codigo: string, vendedor: string): Promise<SegmentoNotetaker[]> {
  const json = await llamar(config, 'GET', `/transcripts/${PLATAFORMA}/${codigo}`);
  const crudos: Record<string, unknown>[] = Array.isArray(json) ? json : (json.segments ?? []);
  const nombreVendedor = normalizar(vendedor);

  // Vexa manda primero un borrador y luego la versión confirmada con el mismo inicio: se queda la última.
  const porClave = new Map<string, SegmentoNotetaker>();
  for (const s of crudos) {
    const texto = String(s.text ?? '').trim();
    if (!texto) continue;
    const hablante = String(s.speaker ?? 'Participante');
    const inicio = Number(s.start_time ?? s.start ?? 0);
    porClave.set(`${hablante}|${inicio.toFixed(1)}`, {
      hablante,
      rol: nombreVendedor && normalizar(hablante).includes(nombreVendedor) ? 'Vendedor' : 'Cliente',
      texto,
      inicio,
      confirmado: s.completed !== false,
    });
  }
  return [...porClave.values()].sort((a, b) => a.inicio - b.inicio);
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// La respuesta de Vexa no está tipada en su documentación; se revisa campo por campo arriba.
async function llamar(config: ConfigVexa, metodo: string, ruta: string, cuerpo?: unknown): Promise<any> {
  const respuesta = await fetch(`${config.url}${ruta}`, {
    method: metodo,
    headers: { 'X-API-Key': config.apiKey ?? '', 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    // Se consulta cada 1.5 s; una respuesta que tarda más de 10 s ya no sirve y no debe trabar la siguiente.
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!respuesta.ok) {
    const detalle = json.detail ?? json.error ?? json.message;
    throw new Error(`Vexa ${respuesta.status}: ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle ?? 'sin detalle')}`);
  }
  return json;
}
