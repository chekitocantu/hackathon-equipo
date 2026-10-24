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
  /** Líneas que no entran al total (falta un dato, consumo o arquitecto): si hay alguna, el total es parcial. */
  sinPrecio: number;
  /** Reglas de escalamiento que se cumplen por las cuentas, sin depender de lo que diga la IA (ej. ESC-09 por monto). */
  reglas: string[];
}

/** ESC-09: presupuesto estimado mayor a este monto al mes (catálogo → reglas de escalamiento). */
const TOPE_MENSUAL_ESTANDAR = 250_000;

const moneda = (valor: number) => `$${Math.round(valor).toLocaleString('en-US')}`;

function cotizarLinea({ sku, estado, cantidad }: ProductoEnEtapa): LineaCotizada {
  const p = producto(sku);
  const unidad = unidadDe(p);
  const base = { producto: p, cantidad: cantidad ?? null, mensual: 0, unico: 0, detalle: '' };

  if (estado === 'arquitecto' || p.tipo === 'a la medida') return { ...base, sinPrecio: 'arquitecto', detalle: 'Lo diseña un arquitecto' };
  if (p.unidad_cobro === 'según consumo') return { ...base, sinPrecio: 'consumo', detalle: 'Se cobra según consumo' };
  // "% del consumo" tiene un mínimo mensual, pero el cobro real depende de lo que use: no se suma como cuota fija.
  if (p.unidad_cobro.startsWith('%')) {
    return { ...base, sinPrecio: 'consumo', detalle: `${p.unidad_cobro.split(' (')[0]}, mínimo ${moneda(p.precio_mensual_mxn ?? 0)} al mes` };
  }
  if (estado === 'pendiente' || (unidad && cantidad === undefined)) {
    return { ...base, sinPrecio: 'falta-dato', detalle: unidad ? `Falta saber cuántos ${unidad}` : 'Por dimensionar' };
  }

  // Sin unidad de cobro y con tope mayor a 1 (ej. agente de conocimiento: hasta 100 usuarios), la cantidad es
  // capacidad y no multiplica el precio. Sin unidad y sin ese tope, la cantidad cuenta piezas (racks, enlaces).
  const esCapacidad = !unidad && (p.cantidad_maxima ?? 0) > 1;
  const n = esCapacidad ? 1 : (cantidad ?? 1);
  const pedido = cantidad ?? n;
  const cuantos = unidad ? ` ${unidad}` : esCapacidad ? ' usuarios' : '';
  // Los límites del catálogo: arriba del máximo lo revisa un arquitecto; abajo del mínimo no se cotiza así.
  if (p.cantidad_maxima !== null && pedido > p.cantidad_maxima) {
    const tope = cuantos ? `Más de ${p.cantidad_maxima}${cuantos}` : `El catálogo cubre hasta ${p.cantidad_maxima}`;
    return { ...base, sinPrecio: 'arquitecto', detalle: `${tope}: lo revisa un arquitecto` };
  }
  if (p.cantidad_minima !== null && pedido < p.cantidad_minima) {
    return { ...base, sinPrecio: 'falta-dato', detalle: `El mínimo es ${p.cantidad_minima}${cuantos}` };
  }

  const esCargoUnico = p.unidad_cobro.startsWith('cargo único');
  const precio = esCargoUnico ? (p.cargo_unico_mxn ?? 0) : (p.precio_mensual_mxn ?? 0);
  const mensual = esCargoUnico ? 0 : precio * n;
  // Los cargos únicos por unidad (buzón, servidor) se multiplican; el de instalación de un servicio mensual, no.
  const unico = esCargoUnico ? precio * n : (p.cargo_unico_mxn ?? 0);
  const detalle = unidad ? `${n} ${unidad} × ${moneda(precio)}` : n > 1 ? `${n} × ${moneda(precio)}` : 'Precio de lista';

  return { ...base, cantidad: esCapacidad ? base.cantidad : n, mensual, unico, detalle: esCargoUnico ? `${detalle} · cargo único` : detalle };
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
    sinPrecio: lineas.length - conPrecio.length,
    reglas: mensual > TOPE_MENSUAL_ESTANDAR ? ['ESC-09'] : [],
  };
}

export type Carril = 'estándar' | 'mixto' | 'a la medida';

/** Estándar si nada pasa por arquitecto; mixto si una parte sí se cotiza hoy; a la medida si nada. */
export function carrilDe(cotizacion: Cotizacion, reglas: string[]): Carril {
  const conArquitecto = reglas.length > 0 || cotizacion.reglas.length > 0 || cotizacion.lineas.some((l) => l.sinPrecio === 'arquitecto');
  if (!conArquitecto) return 'estándar';
  return cotizacion.hayPrecio ? 'mixto' : 'a la medida';
}
