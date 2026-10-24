// Fase de perfil: antes de cotizar, el vendedor entiende al cliente con 10 preguntas fijas.
// Con eso las preguntas de cotización salen dirigidas (no "a lo tonto") y las reglas ESC se ven desde el inicio.
// Lo usan el navegador (pantalla de perfil) y el servidor (prompt de Claude), por eso vive aquí.

export type NivelTecnico = 'básico' | 'intermedio' | 'avanzado';

export interface PreguntaPerfil {
  id: string;
  bloque: 'A' | 'B' | 'C' | 'D';
  texto: string;
  /** Para qué sirve la respuesta; se le muestra al vendedor en chico. */
  revela: string;
}

export const BLOQUES: Record<PreguntaPerfil['bloque'], string> = {
  A: 'Entender el dolor',
  B: 'Nivel técnico',
  C: 'Dimensionar',
  D: 'Decisión y tiempo',
};

export const PREGUNTAS_PERFIL: PreguntaPerfil[] = [
  { id: 'A1', bloque: 'A', texto: '¿Qué pasó que los hizo buscarnos ahora?', revela: 'Urgencia y dolor real' },
  { id: 'A2', bloque: 'A', texto: '¿Cómo lo resuelven hoy?', revela: 'Su situación actual' },
  { id: 'A3', bloque: 'A', texto: 'Si esto vuelve a pasar, ¿qué pierden? ¿Dinero, clientes, tiempo?', revela: 'El argumento de valor' },
  { id: 'B1', bloque: 'B', texto: '¿Quién se encarga de la tecnología en la empresa?', revela: 'Nivel técnico del cliente' },
  { id: 'B2', bloque: 'B', texto: '¿Qué sistemas o programas son los más importantes para su operación?', revela: 'Qué tan técnico hablar' },
  { id: 'C1', bloque: 'C', texto: '¿Cuántas personas y cuántas sucursales usarían el servicio?', revela: 'Precio y umbrales (más de 300 usuarios = ESC-02)' },
  { id: 'C2', bloque: 'C', texto: '¿Manejan información delicada: datos de salud, financieros o de tarjetas?', revela: 'Regla ESC-04 desde el inicio' },
  { id: 'D1', bloque: 'D', texto: 'Además de usted, ¿quién más participa en la decisión?', revela: 'Quién decide' },
  { id: 'D2', bloque: 'D', texto: '¿Para cuándo necesitan tenerlo funcionando?', revela: 'Urgencia y tiempos de implementación' },
  { id: 'D3', bloque: 'D', texto: '¿Tienen un rango de inversión mensual pensado?', revela: 'No ofrecer de más ni de menos (más de $250,000 = ESC-09)' },
];

export interface Perfil {
  /** Respuesta del cliente a cada pregunta (por id), o null si todavía no la dio. */
  respuestas: Record<string, string | null>;
  nivel: NivelTecnico | null;
  /** Reglas ESC que ya se ven venir desde el perfil. */
  reglas: string[];
  /** Familias del catálogo que probablemente apliquen (ids: DC, M365, BK, AWS, AZ, OCI, IA). */
  familias: string[];
  /** Diagnóstico en una o dos frases para el vendedor. */
  resumen: string | null;
  /** Id de la siguiente pregunta de perfil que conviene hacer, o null si ya están todas. */
  siguiente: string | null;
}

export const PERFIL_VACIO: Perfil = { respuestas: {}, nivel: null, reglas: [], familias: [], resumen: null, siguiente: 'A1' };

export const respondidas = (perfil: Perfil) => PREGUNTAS_PERFIL.filter((p) => perfil.respuestas[p.id]).length;

/** Texto del perfil para dárselo al copiloto cuando empieza la fase de cotización. */
export function perfilComoTexto(perfil: Perfil) {
  const lineas = PREGUNTAS_PERFIL.filter((p) => perfil.respuestas[p.id]).map((p) => `- ${p.texto} → ${perfil.respuestas[p.id]}`);
  return [
    perfil.resumen ? `Diagnóstico: ${perfil.resumen}` : '',
    perfil.nivel ? `Nivel técnico del cliente: ${perfil.nivel}` : '',
    perfil.reglas.length ? `Reglas ESC que ya se ven venir: ${perfil.reglas.join(', ')}` : '',
    lineas.length ? `Respuestas del perfil:\n${lineas.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
