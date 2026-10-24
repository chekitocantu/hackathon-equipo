// Cotizador determinista: precios, paquetes, plazo e IVA salen del catálogo.
// La IA decide qué productos aplican; las cuentas las hace este código para no inventar cifras.
import { CONDICIONES, PAQUETES, producto, unidadDe, type Paquete, type Producto } from './catalogo';

export type EstadoProducto = 'incluido' | 'pendiente' | 'arquitecto' | 'sugerido';

export interface ProductoEnEtapa {
  sku: string;
  estado: EstadoProducto;
  /** Usuarios, TB, servidores… según la unidad de cobro. Sin dato todavía, se omite. */
  cantidad?: number;
  /** Texto corto para el mapa cuando la cantidad no lo dice todo (ej. "RTO 1 h"). */
  nota?: string;
}

export type MotivoSinPrecio = 'falta-dato' | 'arquitecto' | 'consumo';

export interface LineaCotizada {
  producto: Producto;
  cantidad: number | null;
  mensual: number;
  unico: number;
  /** Cómo se calculó, para que el vendedor lo pueda explicar (ej. "25 usuarios × $425"). */
  detalle: string;
  sinPrecio?: MotivoSinPrecio;
}

export interface Cotizacion {
  lineas: LineaCotizada[];
  subtotal: number;
  paquete: { paquete: Paquete; monto: number } | null;
  plazo: { meses: number; pct: number; monto: number };
  mensual: number;
  unico: number;
  mensualConIva: number;
  descuentoTotalPct: number;
  rebasaTopeVendedor: boolean;
  hayPrecio: boolean;
}

const moneda = (valor: number) => `$${Math.round(valor).toLocaleString('en-US')}`;

function cotizarLinea({ sku, estado, cantidad }: ProductoEnEtapa): LineaCotizada {
  const p = producto(sku);
  const unidad = unidadDe(p);
  const base = { producto: p, cantidad: cantidad ?? null, mensual: 0, unico: 0, detalle: '' };

  if (estado === 'arquitecto' || p.tipo === 'a la medida') return { ...base, sinPrecio: 'arquitecto', detalle: 'Lo diseña un arquitecto' };
  if (p.unidad_cobro === 'según consumo') return { ...base, sinPrecio: 'consumo', detalle: 'Se cobra según consumo' };
  if (estado === 'pendiente' || (unidad && cantidad === undefined)) {
    return { ...base, sinPrecio: 'falta-dato', detalle: unidad ? `Falta saber cuántos ${unidad}` : 'Por dimensionar' };
  }

  const n = cantidad ?? 1;
  const esCargoUnico = p.unidad_cobro.startsWith('cargo único');
  const precio = esCargoUnico ? (p.cargo_unico_mxn ?? 0) : (p.precio_mensual_mxn ?? 0);
  const mensual = esCargoUnico ? 0 : precio * n;
  // Los cargos únicos por unidad (buzón, servidor) se multiplican; el de instalación de un servicio mensual, no.
  const unico = esCargoUnico ? precio * n : (p.cargo_unico_mxn ?? 0);
  const minimo = p.unidad_cobro.startsWith('%') ? ' (mínimo mensual)' : '';
  const detalle = unidad ? `${n} ${unidad} × ${moneda(precio)}` : n > 1 ? `${n} × ${moneda(precio)}` : `Precio de lista${minimo}`;

  return { ...base, cantidad: n, mensual, unico, detalle: esCargoUnico ? `${detalle} · cargo único` : detalle };
}

export function cotizar(productos: ProductoEnEtapa[], plazoMeses: number): Cotizacion {
  const lineas = productos.filter((p) => p.estado !== 'sugerido').map(cotizarLinea);
  const conPrecio = lineas.filter((l) => !l.sinPrecio);
  const subtotal = conPrecio.reduce((s, l) => s + l.mensual, 0);

  // Un paquete aplica cuando todos sus productos ya están cotizados; si aplican varios, el que más ahorra.
  const skus = new Set(conPrecio.map((l) => l.producto.sku));
  const paquete =
    PAQUETES.filter((pq) => pq.productos.every((s) => skus.has(s)))
      .map((pq) => ({
        paquete: pq,
        monto: (conPrecio.filter((l) => pq.productos.includes(l.producto.sku)).reduce((s, l) => s + l.mensual, 0) * pq.descuento_pct) / 100,
      }))
      .sort((a, b) => b.monto - a.monto)[0] ?? null;

  const trasPaquete = subtotal - (paquete?.monto ?? 0);
  const pctPlazo = CONDICIONES.descuentoPorPlazo[plazoMeses] ?? 0;
  const plazo = { meses: plazoMeses, pct: pctPlazo, monto: (trasPaquete * pctPlazo) / 100 };
  const mensual = trasPaquete - plazo.monto;
  const descuentoTotalPct = subtotal > 0 ? ((subtotal - mensual) / subtotal) * 100 : 0;

  return {
    lineas,
    subtotal,
    paquete,
    plazo,
    mensual,
    unico: conPrecio.reduce((s, l) => s + l.unico, 0),
    mensualConIva: mensual * (1 + CONDICIONES.ivaPct / 100),
    descuentoTotalPct,
    rebasaTopeVendedor: descuentoTotalPct > CONDICIONES.topeVendedorPct,
    hayPrecio: conPrecio.length > 0,
  };
}

export type Carril = 'estándar' | 'mixto' | 'a la medida';

/** Estándar si nada pasa por arquitecto; mixto si una parte sí se cotiza hoy; a la medida si nada. */
export function carrilDe(cotizacion: Cotizacion, reglas: string[]): Carril {
  const conArquitecto = reglas.length > 0 || cotizacion.lineas.some((l) => l.sinPrecio === 'arquitecto');
  if (!conArquitecto) return 'estándar';
  return cotizacion.hayPrecio ? 'mixto' : 'a la medida';
}
