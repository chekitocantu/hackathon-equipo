// Acceso tipado al catálogo simulado del hackathon (../catalogo-simulado).
// Todo precio, regla o pregunta que muestra el simulador sale de aquí; nada se escribe a mano.
import datos from '../../../catalogo-simulado/catalogo-simulado.json';

export type TipoProducto = 'estándar' | 'configurable' | 'a la medida';

export interface Familia {
  id: string;
  nombre: string;
  descripcion: string;
  problemas_que_resuelve: string;
}

export interface Producto {
  sku: string;
  familia: string;
  nombre: string;
  descripcion: string;
  tipo: TipoProducto;
  segmento: string;
  unidad_cobro: string;
  precio_mensual_mxn: number | null;
  cargo_unico_mxn: number | null;
  plazo_minimo_meses: number | null;
  requiere_alguno_de: string[];
  se_recomienda_con: string[];
  senal_del_cliente: string;
  preguntas_clave: string[];
  cuando_entra_arquitecto: string | null;
}

export interface Paquete {
  id: string;
  nombre: string;
  para_quien: string;
  productos: string[];
  descuento_pct: number;
}

export interface CasoCliente {
  id: string;
  empresa: string;
  industria: string;
  ciudad: string;
  empleados: number;
  mensaje_inicial: string;
  informacion_que_falta: string;
  tipo_de_caso: string;
}

interface Catalogo {
  aviso: string;
  familias: Familia[];
  productos: Producto[];
  paquetes: Paquete[];
  condiciones_comerciales: { concepto: string; regla: string }[];
  reglas_escalamiento: { id: string; cuando_entra_un_arquitecto: string }[];
  casos_clientes: CasoCliente[];
}

const catalogo = datos as unknown as Catalogo;

export const FAMILIAS = catalogo.familias;
export const PAQUETES = catalogo.paquetes;
export const AVISO = catalogo.aviso;

function buscar<T>(lista: T[], clave: (x: T) => string, id: string, que: string): T {
  const encontrado = lista.find((x) => clave(x) === id);
  // Si un guion apunta a algo que no está en el catálogo, preferimos que truene a que muestre un dato inventado.
  if (!encontrado) throw new Error(`${que} ${id} no existe en el catálogo simulado`);
  return encontrado;
}

export const producto = (sku: string) => buscar(catalogo.productos, (p) => p.sku, sku, 'El producto');
export const familia = (id: string) => buscar(catalogo.familias, (f) => f.id, id, 'La familia');
export const caso = (id: string) => buscar(catalogo.casos_clientes, (c) => c.id, id, 'El caso');
export const regla = (id: string) =>
  buscar(catalogo.reglas_escalamiento, (r) => r.id, id, 'La regla').cuando_entra_un_arquitecto;

/** Lo que el caso dice que falta preguntar, partido en renglones. */
export const informacionQueFalta = (c: CasoCliente) =>
  c.informacion_que_falta
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim())
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

const condicion = (concepto: string) => buscar(catalogo.condiciones_comerciales, (c) => c.concepto, concepto, 'La condición').regla;

const porcentaje = (texto: string) => Number(/(\d+)%/.exec(texto)?.[1] ?? 0);

export const CONDICIONES = {
  ivaPct: porcentaje(condicion('Moneda e IVA')),
  topeVendedorPct: porcentaje(condicion('Descuento máximo del vendedor')),
  vigenciaDias: Number(/(\d+) días/.exec(condicion('Vigencia de la propuesta'))?.[1] ?? 0),
  descuentoPorPlazo: Object.fromEntries([12, 24, 36].map((m) => [m, porcentaje(condicion(`Plazo de ${m} meses`))])) as Record<
    number,
    number
  >,
};

const UNIDADES: Record<string, string> = {
  usuario: 'usuarios',
  servidor: 'servidores',
  TB: 'TB',
  equipo: 'equipos',
  buzón: 'buzones',
  prueba: 'pruebas',
};

/** Si el producto se cobra por unidad, el nombre de la unidad en plural (usuarios, TB…). */
export function unidadDe(p: Producto): string | null {
  const unidad = /por (usuario|servidor|TB|equipo|buzón|prueba)/.exec(p.unidad_cobro)?.[1];
  return unidad ? UNIDADES[unidad] : null;
}
