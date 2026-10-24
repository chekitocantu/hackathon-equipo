// Guion del simulador: la llamada de ejemplo con la cadena de ferreterías
// (ver propuesta_y_guion_de_demo_agente_ia_alestra.md). Los precios son de ejemplo.

export type EstadoNodo = 'activo' | 'pendiente' | 'inactivo';

export interface NodoMapa {
  id: string;
  padre?: string;
  nivel: 0 | 1 | 2;
  /** Centro horizontal dentro del viewBox de 1080px del mapa. */
  x: number;
  ancho: number;
  etiqueta: string;
  /** Lo que se muestra mientras el agente todavía espera el dato. */
  etiquetaPendiente?: string;
  /** Servicios de la familia que existen en el catálogo, aunque estén ocultos. */
  totalServicios?: number;
}

export const NODOS: NodoMapa[] = [
  { id: 'telecom', nivel: 0, x: 135, ancho: 230, etiqueta: 'Telecom' },
  { id: 'ti', nivel: 0, x: 405, ancho: 230, etiqueta: 'TI', totalServicios: 7 },
  { id: 'movilidad', nivel: 0, x: 675, ancho: 230, etiqueta: 'Movilidad' },
  { id: 'ciber', nivel: 0, x: 945, ancho: 230, etiqueta: 'Ciberseguridad' },

  { id: 'internet', padre: 'telecom', nivel: 1, x: 68, ancho: 132, etiqueta: 'Internet dedicado' },
  { id: 'sdwan', padre: 'telecom', nivel: 1, x: 206, ancho: 132, etiqueta: 'Managed SD-WAN' },
  { id: 'nube', padre: 'ti', nivel: 1, x: 405, ancho: 170, etiqueta: 'Nube', etiquetaPendiente: '¿Qué nube usan?' },
  { id: 'sim', padre: 'movilidad', nivel: 1, x: 610, ancho: 136, etiqueta: 'SIM multioperador', etiquetaPendiente: '¿Sitio sin fibra?' },
  { id: 'respaldo', padre: 'movilidad', nivel: 1, x: 746, ancho: 124, etiqueta: 'Respaldo celular' },
  { id: 'cleanpipes', padre: 'ciber', nivel: 1, x: 945, ancho: 170, etiqueta: 'Clean Pipes' },

  { id: 'mbps', padre: 'internet', nivel: 2, x: 68, ancho: 132, etiqueta: '100 Mbps', etiquetaPendiente: '¿Cuántos Mbps?' },
  { id: 'qos', padre: 'sdwan', nivel: 2, x: 206, ancho: 132, etiqueta: 'QoS para cajas' },
  { id: 'cloudexpress', padre: 'nube', nivel: 2, x: 405, ancho: 170, etiqueta: 'Cloud Express · AWS' },
  { id: 'bodega', padre: 'sim', nivel: 2, x: 610, ancho: 136, etiqueta: 'Bodega R. Arizpe' },
  { id: 'cleanpipes-ddos', padre: 'cleanpipes', nivel: 2, x: 945, ancho: 170, etiqueta: 'Mitigación DDoS' },
];

export const DATOS = [
  { clave: 'giro', etiqueta: 'Giro' },
  { clave: 'sucursales', etiqueta: 'Sucursales' },
  { clave: 'ciudades', etiqueta: 'Ciudades' },
  { clave: 'equipos', etiqueta: 'Equipos por tienda' },
  { clave: 'nube', etiqueta: 'Nube' },
  { clave: 'cobertura', etiqueta: 'Cobertura de fibra' },
  { clave: 'tolerancia', etiqueta: 'Tolerancia a caídas' },
] as const;

export type ClaveDato = (typeof DATOS)[number]['clave'];

export interface LineaCotizacion {
  concepto: string;
  tipo: 'estandar' | 'medida';
  /** null mientras falte un dato para poner precio. */
  precio: number | null;
}

export interface Etapa {
  id: string;
  nombre: string;
  minuto: string;
  resumen: string;
  cliente: string | null;
  precision: number;
  /** Los nodos que no aparecen aquí siguen ocultos (las familias se ven en gris). */
  nodos: Record<string, EstadoNodo>;
  etiquetas?: Record<string, string>;
  pregunta: { texto: string; motivo: string } | null;
  datos: Partial<Record<ClaveDato, string>>;
  lineas: LineaCotizacion[];
  arquitecto: boolean;
}

const DATOS_TURNO_1 = {
  giro: 'Retail',
  sucursales: '10',
  ciudades: 'Monterrey y Saltillo',
};

const DATOS_TURNO_2 = {
  ...DATOS_TURNO_1,
  equipos: '15 PCs + cámaras',
  nube: 'AWS',
};

export const ETAPAS: Etapa[] = [
  {
    id: 'inicio',
    nombre: 'Inicio',
    minuto: '00:00',
    resumen: 'Escuchando',
    cliente: null,
    precision: 0,
    nodos: {},
    pregunta: {
      texto: '¿Qué es lo que más les está frenando hoy en la operación?',
      motivo: 'Empieza por el problema del negocio, no por el producto',
    },
    datos: {},
    lineas: [],
    arquitecto: false,
  },
  {
    id: 'turno-1',
    nombre: 'Turno 1',
    minuto: '02:10',
    resumen: 'Detecta el dolor',
    cliente:
      'Tenemos 10 ferreterías en Monterrey y Saltillo. Usamos un sistema en la nube para cobrar, pero el internet se pone lentísimo y las cajas se traban sin poder facturar.',
    precision: 30,
    nodos: {
      telecom: 'activo',
      internet: 'activo',
      sdwan: 'activo',
      qos: 'activo',
      mbps: 'pendiente',
      ti: 'pendiente',
      nube: 'pendiente',
    },
    pregunta: {
      texto: '¿Cuántas computadoras o cajas tienen por tienda y en qué nube está su sistema de cobro?',
      motivo: 'Sin esto no se puede dimensionar el Internet dedicado',
    },
    datos: DATOS_TURNO_1,
    lineas: [
      { concepto: 'Managed SD-WAN × 10', tipo: 'estandar', precio: 1100 },
      { concepto: 'Internet dedicado × 10', tipo: 'estandar', precio: null },
    ],
    arquitecto: false,
  },
  {
    id: 'turno-2',
    nombre: 'Turno 2',
    minuto: '05:40',
    resumen: 'Dimensiona',
    cliente:
      'No sé cuántos megas gastamos, pero son como 15 computadoras por sucursal y además cámaras de seguridad. El sistema está en Amazon (AWS).',
    precision: 75,
    nodos: {
      telecom: 'activo',
      internet: 'activo',
      sdwan: 'activo',
      qos: 'activo',
      mbps: 'activo',
      ti: 'activo',
      nube: 'activo',
      cloudexpress: 'activo',
      movilidad: 'pendiente',
      sim: 'pendiente',
    },
    etiquetas: { mbps: '100 Mbps × 10' },
    pregunta: {
      texto: '¿Alguna tienda está en una zona donde no llega la fibra, y qué pasa si una se queda sin conexión?',
      motivo: 'Define si hace falta Movilidad y un enlace de respaldo',
    },
    datos: DATOS_TURNO_2,
    lineas: [
      { concepto: 'Internet dedicado 100 Mbps × 10', tipo: 'estandar', precio: 2100 },
      { concepto: 'Managed SD-WAN × 10', tipo: 'estandar', precio: 1100 },
      { concepto: 'Cloud Express AWS', tipo: 'estandar', precio: 450 },
    ],
    arquitecto: false,
  },
  {
    id: 'cierre',
    nombre: 'Cierre',
    minuto: '08:30',
    resumen: 'Propuesta lista',
    cliente:
      'Nuestra bodega nueva está en las afueras de Ramos Arizpe y ahí no hay fibra. Y no nos podemos quedar sin sistema ni 5 minutos.',
    precision: 100,
    nodos: {
      telecom: 'activo',
      internet: 'activo',
      sdwan: 'activo',
      qos: 'activo',
      mbps: 'activo',
      ti: 'activo',
      nube: 'activo',
      cloudexpress: 'activo',
      movilidad: 'activo',
      sim: 'activo',
      respaldo: 'activo',
      bodega: 'activo',
      ciber: 'activo',
      cleanpipes: 'activo',
      'cleanpipes-ddos': 'activo',
    },
    etiquetas: { mbps: '100 Mbps × 9' },
    pregunta: null,
    datos: {
      ...DATOS_TURNO_2,
      cobertura: '1 bodega sin fibra',
      tolerancia: 'Cero tiempo caído',
    },
    lineas: [
      { concepto: 'Internet dedicado 100 Mbps × 9', tipo: 'estandar', precio: 1890 },
      { concepto: 'Managed SD-WAN × 10', tipo: 'estandar', precio: 1100 },
      { concepto: 'Cloud Express AWS', tipo: 'estandar', precio: 450 },
      { concepto: 'SIM multioperador 5G · bodega', tipo: 'medida', precio: 180 },
      { concepto: 'Respaldo celular × 9', tipo: 'estandar', precio: 270 },
      { concepto: 'Clean Pipes', tipo: 'estandar', precio: 310 },
    ],
    arquitecto: false,
  },
];
