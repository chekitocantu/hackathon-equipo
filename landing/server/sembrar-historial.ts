// Carga los 10 casos del catálogo simulado en InsForge como si fueran llamadas pasadas, para que la demo
// tenga "clientes parecidos" y, si se repite un cliente, "ya lo sabemos". Se puede correr varias veces:
// cada caso usa siempre el mismo id de llamada y los datos se actualizan en vez de duplicarse.
//   cd landing && node server/sembrar-historial.ts
// Los datos son simulados (catalogo-simulado/); no hay información de clientes reales.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configInsforge, crearMemoria } from './memoria.ts';
import { evaluar, preguntasDelCliente, type ProductoCatalogo } from './ayuda.ts';

const raiz = resolve(import.meta.dirname, '..');
const catalogo = JSON.parse(readFileSync(resolve(raiz, '../catalogo-simulado/catalogo-simulado.json'), 'utf8')) as {
  productos: ProductoCatalogo[];
  reglas_escalamiento: { id: string; cuando_entra_un_arquitecto: string }[];
  casos_clientes: { id: string; empresa: string; industria: string; ciudad: string; empleados: number; mensaje_inicial: string; tipo_de_caso: string }[];
};

// Lo que el agente detectaría en el primer mensaje de cada caso (productos, reglas ESC y datos que el cliente dio).
type Detectado = { productos: [string, string, number?][]; reglas?: string[]; datos: [string, string][] };
const DETECTADO: Record<string, Detectado> = {
  'CASO-01': { productos: [['SIM-M365-03', 'pendiente'], ['SIM-M365-06', 'pendiente'], ['SIM-BK-02', 'sugerido']], datos: [['Correo actual', 'Gmail personal'], ['Incidente', 'Ransomware el mes pasado']] },
  'CASO-02': { productos: [['SIM-DC-01', 'pendiente'], ['SIM-DC-08', 'sugerido'], ['SIM-DC-09', 'arquitecto']], datos: [['Servidores', '2 (ERP)'], ['Cortes de luz', '2 este año']] },
  'CASO-03': { productos: [['SIM-AWS-04', 'incluido', 1], ['SIM-AWS-03', 'pendiente'], ['SIM-AWS-01', 'pendiente']], reglas: ['ESC-04'], datos: [['Gasto en AWS', '+60% en 6 meses'], ['Regulación', 'CNBV']] },
  'CASO-04': { productos: [['SIM-M365-04', 'arquitecto'], ['SIM-AZ-03', 'pendiente'], ['SIM-AZ-02', 'pendiente']], reglas: ['ESC-02'], datos: [['Usuarios', 'Maestros y personal'], ['Laboratorios', 'Escritorios virtuales']] },
  'CASO-05': { productos: [['SIM-IA-01', 'pendiente'], ['SIM-IA-04', 'sugerido']], datos: [['Sucursales', '45'], ['Mensajes', 'Cientos de WhatsApps al día']] },
  'CASO-06': { productos: [['SIM-OCI-02', 'arquitecto'], ['SIM-OCI-03', 'arquitecto'], ['SIM-OCI-05', 'sugerido']], reglas: ['ESC-08'], datos: [['Base de datos', 'Oracle, 6 TB'], ['Hardware', 'Vence el próximo año']] },
  'CASO-07': { productos: [['SIM-BK-01', 'pendiente'], ['SIM-BK-05', 'pendiente']], datos: [['Retención', '5 años (SAT)']] },
  'CASO-08': { productos: [['SIM-AZ-06', 'arquitecto'], ['SIM-DC-07', 'pendiente'], ['SIM-IA-02', 'pendiente']], reglas: ['ESC-06'], datos: [['Entornos', 'Azure y data center propio']] },
  'CASO-09': { productos: [['SIM-M365-05', 'pendiente'], ['SIM-M365-02', 'sugerido']], datos: [['Archivos', 'Muy pesados, compartidos']] },
  'CASO-10': { productos: [['SIM-DC-02', 'pendiente'], ['SIM-DC-09', 'arquitecto']], reglas: ['ESC-04'], datos: [['Datos', 'Expediente clínico (salud)']] },
};
const textoDeRegla = new Map(catalogo.reglas_escalamiento.map((r) => [r.id, r.cuando_entra_un_arquitecto]));
const productosDelCatalogo = new Map(catalogo.productos.map((p) => [p.sku, p]));

// Id fijo por caso (uuid v4 con el número del caso al final) para que volver a correr no duplique llamadas.
const idDe = (caso: string) => `00000000-0000-4000-8000-${caso.replace(/\D/g, '').padStart(12, '0')}`;

const env = Object.fromEntries(
  Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'),
);
const nombres = new Map(catalogo.productos.map((p) => [p.sku, p.nombre]));
const memoria = crearMemoria(configInsforge(env, raiz), (sku) => nombres.get(sku) ?? sku);
if (!memoria) {
  console.error('Falta InsForge: pon INSFORGE_URL e INSFORGE_API_KEY o enlaza el proyecto con `npx -y @insforge/cli link`.');
  process.exit(1);
}

for (const caso of catalogo.casos_clientes) {
  const d = DETECTADO[caso.id];
  if (!d) continue;
  const llamada = { id: idDe(caso.id), origen: 'historial' };
  const transcripcion = [{ quien: 'Cliente', texto: caso.mensaje_inicial }];
  const productos = d.productos.map(([sku, estado, cantidad]) => ({ sku, estado, cantidad }));
  await memoria.guardar(llamada, transcripcion, {
    empresa: caso.empresa,
    industria: caso.industria,
    productos,
    datos: [['Empleados', String(caso.empleados)], ['Ciudad', caso.ciudad], ...d.datos].map(([etiqueta, valor]) => ({ etiqueta, valor })),
  });
  const preguntas = await memoria.preguntas(llamada.id, preguntasDelCliente(transcripcion));
  const reglas = (d.reglas ?? []).map((id) => ({ id, texto: textoDeRegla.get(id) ?? id }));
  const ayuda = evaluar(preguntas, productos, reglas, productosDelCatalogo);
  await memoria.guardarAyuda(llamada.id, ayuda);
  console.log(`${caso.id} ${caso.empresa}: ${ayuda.tipoCaso} (catálogo: ${caso.tipo_de_caso}) · IT ${ayuda.nivel}`);
}
