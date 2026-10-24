// Guiones del simulador: tres casos del catálogo, uno por carril (estándar, mixto y a la medida).
// El primer mensaje y lo que falta saber vienen del catálogo; las respuestas siguientes del cliente
// son nuestras, inventadas para el demo, y solo usan productos que existen en el catálogo.
import { caso, producto, type CasoCliente } from './catalogo';
import type { ProductoEnEtapa } from './cotizador';

export interface Pregunta {
  texto: string;
  motivo: string;
  /** De dónde sale la pregunta, para que se vea que no es invento. */
  fuente: string;
  /** Si viene del banco de objeciones: lo que el vendedor no debe decir en ese momento. */
  cuidado?: string | null;
  /** Frase de reconocimiento sugerida por el banco, sin implicar que el vendedor esté de acuerdo. */
  diMejor?: string | null;
}

export interface Etapa {
  id: string;
  nombre: string;
  minuto: string;
  resumen: string;
  cliente: string;
  productos: ProductoEnEtapa[];
  /** Respuesta a cada renglón de "información que falta" del caso; null si aún no se sabe. */
  datos: (string | null)[];
  /** Reglas de escalamiento (ESC-xx) que ya se activaron. */
  reglas: string[];
  pregunta: Pregunta | null;
}

export interface Guion {
  caso: CasoCliente;
  nombreCorto: string;
  etapas: Etapa[];
}

const delCatalogo = (sku: string, indice: number, motivo: string): Pregunta => {
  const p = producto(sku);
  return { texto: p.preguntas_clave[indice], motivo, fuente: `Catálogo · ${p.nombre}` };
};

const delCaso = (texto: string, motivo: string): Pregunta => ({ texto, motivo, fuente: 'Información que falta del caso' });

const clinica: Guion = {
  caso: caso('CASO-01'),
  nombreCorto: 'Clínica Dental',
  etapas: [
    {
      id: 'c1-1',
      nombre: 'Primer mensaje',
      minuto: '00:30',
      resumen: 'Detecta el dolor',
      cliente: caso('CASO-01').mensaje_inicial,
      productos: [
        { sku: 'SIM-M365-03', estado: 'pendiente' },
        { sku: 'SIM-M365-06', estado: 'pendiente' },
        { sku: 'SIM-BK-02', estado: 'pendiente' },
      ],
      datos: [null, null, null],
      reglas: [],
      pregunta: delCatalogo('SIM-M365-03', 0, 'Con esto se calculan las licencias, la migración y el respaldo'),
    },
    {
      id: 'c1-2',
      nombre: 'Turno 2',
      minuto: '03:10',
      resumen: 'Dimensiona',
      cliente: 'Somos 25 personas, cada quien con su computadora. Los respaldos los hacemos en un disco duro externo los viernes.',
      productos: [
        { sku: 'SIM-M365-03', estado: 'incluido', cantidad: 25 },
        { sku: 'SIM-M365-06', estado: 'incluido', cantidad: 25 },
        { sku: 'SIM-M365-07', estado: 'sugerido', nota: 'Completa el paquete' },
        { sku: 'SIM-BK-02', estado: 'incluido', cantidad: 25 },
      ],
      datos: ['25 usuarios y 25 equipos', null, 'Disco externo los viernes'],
      reglas: [],
      pregunta: delCaso(
        '¿Guardan expedientes de pacientes en las computadoras o en el correo?',
        'Si hay datos de salud, el caso pasa a un arquitecto (ESC-04)',
      ),
    },
    {
      id: 'c1-3',
      nombre: 'Cierre',
      minuto: '05:20',
      resumen: 'Propuesta lista',
      cliente:
        'No, los expedientes están en el software dental, que es en línea. Aquí solo hay agenda y facturas. Y no tenemos área de sistemas; todo lo ve el contador.',
      productos: [
        { sku: 'SIM-M365-03', estado: 'incluido', cantidad: 25 },
        { sku: 'SIM-M365-06', estado: 'incluido', cantidad: 25 },
        { sku: 'SIM-M365-07', estado: 'incluido', cantidad: 25 },
        { sku: 'SIM-BK-02', estado: 'incluido', cantidad: 25 },
      ],
      datos: ['25 usuarios y 25 equipos', 'No, están en el software dental', 'Disco externo los viernes'],
      reglas: [],
      pregunta: null,
    },
  ],
};

const aceros: Guion = {
  caso: caso('CASO-02'),
  nombreCorto: 'Aceros del Valle',
  etapas: [
    {
      id: 'c2-1',
      nombre: 'Primer mensaje',
      minuto: '00:30',
      resumen: 'Detecta el dolor',
      cliente: caso('CASO-02').mensaje_inicial,
      productos: [
        { sku: 'SIM-DC-01', estado: 'pendiente', nota: '¿Cuántas U?' },
        { sku: 'SIM-BK-01', estado: 'sugerido' },
      ],
      datos: [null, null, null],
      reglas: [],
      pregunta: delCatalogo('SIM-DC-01', 0, 'Define cuánto espacio de rack necesitan en el data center'),
    },
    {
      id: 'c2-2',
      nombre: 'Turno 2',
      minuto: '04:00',
      resumen: 'Dimensiona',
      cliente: 'Son dos servidores de 2U y un switch; casi no consumen. Tenemos 3 sucursales que entran al ERP.',
      productos: [
        { sku: 'SIM-DC-01', estado: 'incluido', nota: '2 servidores + switch' },
        { sku: 'SIM-DC-08', estado: 'incluido', cantidad: 3, nota: '3 sucursales' },
        { sku: 'SIM-BK-01', estado: 'pendiente' },
        { sku: 'SIM-BK-03', estado: 'incluido', cantidad: 2 },
        { sku: 'SIM-DC-07', estado: 'sugerido' },
      ],
      datos: ['2 servidores de 2U + switch', null, 'Sí, 3 sucursales'],
      reglas: [],
      pregunta: delCatalogo('SIM-DC-07', 1, 'Si es menos de 4 horas, ya no es un nivel de servicio estándar (ESC-07)'),
    },
    {
      id: 'c2-3',
      nombre: 'Cierre',
      minuto: '07:10',
      resumen: 'Cotiza y escala',
      cliente: 'Máximo una hora; cada hora parada es producción perdida. Entre los dos servidores son como 3 TB.',
      productos: [
        { sku: 'SIM-DC-01', estado: 'incluido', nota: '2 servidores + switch' },
        { sku: 'SIM-DC-08', estado: 'incluido', cantidad: 3, nota: '3 sucursales' },
        { sku: 'SIM-BK-01', estado: 'incluido', cantidad: 3 },
        { sku: 'SIM-BK-03', estado: 'incluido', cantidad: 2 },
        { sku: 'SIM-DC-07', estado: 'arquitecto', nota: 'Volver en 1 h' },
      ],
      datos: ['2 servidores de 2U + switch · 3 TB', 'Máximo 1 hora', 'Sí, 3 sucursales'],
      reglas: ['ESC-07'],
      pregunta: null,
    },
  ],
};

const autopartes: Guion = {
  caso: caso('CASO-08'),
  nombreCorto: 'AutoPartes Regio',
  etapas: [
    {
      id: 'c8-1',
      nombre: 'Primer mensaje',
      minuto: '00:40',
      resumen: 'Detecta el dolor',
      cliente: caso('CASO-08').mensaje_inicial,
      productos: [
        { sku: 'SIM-AZ-06', estado: 'arquitecto', nota: 'Azure + data center' },
        { sku: 'SIM-DC-07', estado: 'pendiente' },
        { sku: 'SIM-IA-02', estado: 'pendiente', nota: '¿Cuántos usuarios?' },
      ],
      datos: [null, null, null],
      reglas: ['ESC-06'],
      pregunta: delCatalogo('SIM-DC-07', 0, 'El plan de recuperación se dimensiona por servidor crítico'),
    },
    {
      id: 'c8-2',
      nombre: 'Turno 2',
      minuto: '05:30',
      resumen: 'Levanta requisitos',
      cliente:
        'Lo crítico es producción y el portal de proveedores: 12 servidores, entre Azure y nuestro data center. Tienen que volver en menos de 2 horas.',
      productos: [
        { sku: 'SIM-AZ-06', estado: 'arquitecto', nota: 'Azure + data center' },
        { sku: 'SIM-DC-07', estado: 'arquitecto', nota: '12 servidores · 2 h' },
        { sku: 'SIM-IA-02', estado: 'pendiente', nota: '¿Cuántos usuarios?' },
      ],
      datos: ['12 servidores · volver en menos de 2 h', null, null],
      reglas: ['ESC-06', 'ESC-07'],
      pregunta: delCatalogo('SIM-IA-02', 1, 'Con más de 100 usuarios, el asistente también lo diseña un arquitecto'),
    },
    {
      id: 'c8-3',
      nombre: 'Cierre',
      minuto: '09:00',
      resumen: 'Resumen al arquitecto',
      cliente: 'Unos 800 supervisores y operadores. Los procedimientos son como 3,000 PDFs en SharePoint, con permisos distintos por planta.',
      productos: [
        { sku: 'SIM-AZ-06', estado: 'arquitecto', nota: 'Azure + data center' },
        { sku: 'SIM-DC-07', estado: 'arquitecto', nota: '12 servidores · 2 h' },
        { sku: 'SIM-IA-02', estado: 'arquitecto', nota: '800 usuarios' },
      ],
      datos: ['12 servidores · volver en menos de 2 h', '≈3,000 PDFs en SharePoint', '800 supervisores y operadores'],
      reglas: ['ESC-06', 'ESC-07'],
      pregunta: null,
    },
  ],
};

export const GUIONES: Guion[] = [clinica, aceros, autopartes];

/**
 * La conversación de un guion como si fuera una llamada: lo que dice el cliente en cada etapa y,
 * después, la pregunta que hace el vendedor. Sirve para el modo demo de "Enlaza tu llamada",
 * donde estas líneas pasan por el agente real en lugar de ir pintadas a mano.
 */
export function conversacionDeGuion(guion: Guion): { quien: 'Cliente' | 'Vendedor'; texto: string }[] {
  return guion.etapas.flatMap((e) => [
    { quien: 'Cliente' as const, texto: e.cliente },
    ...(e.pregunta ? [{ quien: 'Vendedor' as const, texto: e.pregunta.texto }] : []),
  ]);
}
