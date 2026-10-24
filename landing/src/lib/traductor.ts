// El Traductor: al terminar la llamada, la misma conversación contada para tres áreas, cada una en su idioma
// (guía en notas/lenguaje-traductor.md). Estos tipos los comparten el servidor (server/traductor.ts) y la pantalla.
// Los números de Finanzas los calcula el cotizador; el modelo solo los interpreta.

export interface ReporteVentas {
  /** Quién es el cliente en una o dos frases. */
  perfil: string | null;
  /** Su dolor, con su cita textual cuando la hay. */
  dolor: { texto: string; cita: string | null }[];
  /** Qué lo mueve a comprar (miedo, urgencia, ahorro, cumplir una regla…). */
  motivadores: string[];
  /** Objeciones que probablemente ponga, con cómo responderlas. */
  objeciones: { objecion: string; respuesta: string }[];
  /** Cómo hablarle según su nivel técnico. */
  comoHablarle: string | null;
  decide: string | null;
  cuando: string | null;
  siguientePaso: string | null;
  /** Lo que el vendedor ya le dijo o prometió al cliente. */
  prometido: string[];
}

export type EstadoRequisito = 'Confirmado' | 'Supuesto' | 'Falta';

export interface ReporteIT {
  resumen: string | null;
  /** Por qué entra (o no) un arquitecto, con las reglas ESC. */
  porQueArquitecto: string | null;
  requisitos: { parametro: string; valor: string | null; estado: EstadoRequisito; fuente: string | null }[];
  preguntasAbiertas: string[];
  prometido: string[];
}

export interface ReporteFinanzas {
  /** Cómo leer los números del trato, en dos o tres frases. */
  lectura: string | null;
  riesgos: string[];
  recomendacion: string | null;
}

export interface Traduccion {
  ventas: ReporteVentas | null;
  it: ReporteIT | null;
  finanzas: ReporteFinanzas | null;
  /** Si algún área falló, las otras dos se muestran igual y aquí va por qué. */
  errores: string[];
}

/** Números del trato que calcula el cotizador en el navegador y se le pasan al modelo para que los explique. */
export interface NumerosTrato {
  plazoMeses: number;
  mensual: number;
  mensualConIva: number;
  unico: number;
  valorContrato: number;
  subtotal: number;
  descuentoPaquete: { nombre: string; pct: number; monto: number } | null;
  descuentoPlazo: { pct: number; monto: number };
  descuentoTotalPct: number;
  rebasaTopeVendedor: boolean;
  topeVendedorPct: number;
  sinPrecio: string[];
  presupuestoCliente: string | null;
}

/** Lo que manda la pantalla al servidor para traducir. */
export interface EntradaTraductor {
  transcripcion: { quien: string; texto: string }[];
  perfil: string;
  empresa: string | null;
  productos: { sku: string; estado: string; cantidad?: number; nota?: string }[];
  reglas: string[];
  datos: { etiqueta: string; valor: string | null }[];
  numeros: NumerosTrato;
}
