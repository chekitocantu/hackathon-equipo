// Los dos documentos que salen del tablero al final de la llamada:
//   - Propuesta: para el cliente (y su hoja para Finanzas). Todo número sale del cotizador; la IA no escribe ninguno.
//   - Brief para IT: la voz C de notas/lenguaje-traductor.md. Aquí se arma la base con lo que ya se sabe;
//     el servidor (/api/brief) le pide a Claude que lo redacte mejor sin cambiar productos, reglas ni precios.
import type { Ayuda, PuntoIT } from './ayuda';
import { CONDICIONES, CONDICIONES_COMERCIALES } from './catalogo';
import { citaLiteral, recortar, respaldoDe, type Linea } from './citas';
import type { Carril, Cotizacion } from './cotizador';

export type EstadoDato = 'Confirmado' | 'Supuesto' | 'Falta';

export interface Requisito {
  parametro: string;
  valor: string;
  estado: EstadoDato;
  fuente: string;
}

export interface ClienteDocumento {
  empresa: string | null;
  industria?: string | null;
  ciudad?: string | null;
  empleados?: number | null;
}

export interface Brief {
  cliente: string;
  resumen: string;
  tipoCaso: string;
  entraIT: PuntoIT[];
  requisitos: Requisito[];
  productos: { sku: string; nombre: string; tipo: string; cantidad: string; quien: string }[];
  preguntasAbiertas: string[];
  contextoComercial: Requisito[];
  loQueSeDijo: string[];
  /** Quién lo redactó: Claude (con las citas revisadas) o el código, si el modelo no respondió. */
  autor: 'Claude' | 'código';
}

export interface Propuesta {
  cliente: string;
  fecha: string;
  vigencia: string;
  lineas: { sku: string; nombre: string; detalle: string; mensual: number; unico: number }[];
  aparte: { nombre: string; motivo: string }[];
  subtotal: number;
  descuentos: { concepto: string; monto: number }[];
  mensual: number;
  ivaPct: number;
  mensualConIva: number;
  unico: number;
  parcial: boolean;
  finanzas: { concepto: string; valor: string }[];
  condiciones: string[];
}

export interface EntradaDocumento {
  cliente: ClienteDocumento;
  datos: { etiqueta: string; valor: string | null }[];
  cotizacion: Cotizacion;
  carril: Carril;
  ayuda: Ayuda;
  conversacion: Linea[];
}

export const moneda = (valor: number) => `$${Math.round(valor).toLocaleString('en-US')}`;
const hoy = () => new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const nombreCliente = (c: ClienteDocumento) => c.empresa?.trim() || 'Cliente por identificar';

const QUIEN: Record<string, string> = {
  arquitecto: 'Arquitecto',
  'falta-dato': 'Ventas · falta un dato',
  consumo: 'Ventas · según consumo',
};

/** El brief armado solo con código: lo que se sabe, con su estado. Es el respaldo si Claude no responde. */
export function briefBase({ cliente, datos, cotizacion, carril, ayuda, conversacion }: EntradaDocumento): Brief {
  const primeraDelCliente = conversacion.find((l) => /cliente/i.test(l.quien))?.texto;
  const perfil = [cliente.industria, cliente.empleados ? `${cliente.empleados} empleados` : null, cliente.ciudad].filter(Boolean).join(', ');

  const requisitos = datos.map((d): Requisito => {
    if (!d.valor) return { parametro: d.etiqueta, valor: '—', estado: 'Falta', fuente: '—' };
    const cita = respaldoDe(d.valor, conversacion);
    return cita
      ? { parametro: d.etiqueta, valor: d.valor, estado: 'Confirmado', fuente: `Cliente: "${recortar(cita)}"` }
      : { parametro: d.etiqueta, valor: d.valor, estado: 'Supuesto', fuente: 'Deducido de la llamada; confirmar' };
  });

  // Lo que el arquitecto tendría que preguntar: los datos que faltan y las preguntas clave de lo que le toca,
  // menos las que el vendedor ya hizo en la llamada.
  const delVendedor = conversacion.filter((l) => /vendedor/i.test(l.quien));
  const deIT = cotizacion.lineas
    .filter((l) => l.sinPrecio === 'arquitecto')
    .flatMap((l) => l.producto.preguntas_clave)
    .filter((p) => !citaLiteral(p, delVendedor));
  const preguntasAbiertas = [
    ...requisitos.filter((r) => r.estado === 'Falta').map((r) => `${r.parametro}: Falta`),
    ...deIT,
    ...ayuda.preguntasTecnicas.map((p) => `El cliente preguntó: "${recortar(p)}"`),
  ].filter((p, i, todas) => todas.indexOf(p) === i);

  const conPrecio = cotizacion.lineas.filter((l) => !l.sinPrecio);
  return {
    cliente: nombreCliente(cliente),
    resumen: [perfil || 'Giro y tamaño: Falta', primeraDelCliente ? `Dolor: "${recortar(primeraDelCliente, 160)}"` : null].filter(Boolean).join('. '),
    tipoCaso:
      ayuda.entra.length > 0
        ? `${carril.charAt(0).toUpperCase()}${carril.slice(1)}. Entra arquitecto por: ${ayuda.entra.map((e) => e.tema).join('; ')}.`
        : `${carril.charAt(0).toUpperCase()}${carril.slice(1)}. No entra arquitecto.`,
    entraIT: ayuda.entra,
    requisitos,
    productos: cotizacion.lineas.map((l) => ({
      sku: l.producto.sku,
      nombre: l.producto.nombre,
      tipo: l.producto.tipo,
      cantidad: l.cantidad === null ? '—' : String(l.cantidad),
      quien: l.sinPrecio ? QUIEN[l.sinPrecio] : 'Ventas · cotizado',
    })),
    preguntasAbiertas: preguntasAbiertas.slice(0, 10),
    contextoComercial: [
      conPrecio.length
        ? {
            parametro: 'Parte estándar cotizada',
            valor: `${moneda(cotizacion.mensual)} MXN/mes sin IVA a ${cotizacion.plazo.meses} meses${cotizacion.sinPrecio ? ' (parcial)' : ''}`,
            estado: 'Confirmado',
            fuente: 'Cotizador (catálogo)',
          }
        : { parametro: 'Parte estándar cotizada', valor: '—', estado: 'Falta', fuente: '—' },
      { parametro: 'Presupuesto del cliente', valor: '—', estado: 'Falta', fuente: '—' },
      { parametro: 'Fecha de arranque', valor: '—', estado: 'Falta', fuente: '—' },
      { parametro: 'Quién decide', valor: '—', estado: 'Falta', fuente: '—' },
    ],
    // Lo que el vendedor explicó o prometió (sus preguntas no), para que IT no lo contradiga.
    loQueSeDijo: delVendedor
      .filter((l) => !l.texto.trim().endsWith('?'))
      .map((l) => recortar(l.texto, 200))
      .slice(-6),
    autor: 'código',
  };
}

/** La propuesta para el cliente: solo lo que tiene precio de lista; lo demás se nombra y va aparte. */
export function propuestaDe({ cliente, cotizacion }: EntradaDocumento): Propuesta {
  const conPrecio = cotizacion.lineas.filter((l) => !l.sinPrecio);
  const descuentos = [
    ...(cotizacion.paquete
      ? [{ concepto: `Paquete «${cotizacion.paquete.paquete.nombre}» (${cotizacion.paquete.paquete.descuento_pct}%)`, monto: cotizacion.paquete.monto }]
      : []),
    ...(cotizacion.plazo.monto > 0 ? [{ concepto: `Plazo de ${cotizacion.plazo.meses} meses (${cotizacion.plazo.pct}%)`, monto: cotizacion.plazo.monto }] : []),
  ];
  const texto = (concepto: string) => {
    const c = CONDICIONES_COMERCIALES.find((x) => x.concepto === concepto);
    return c ? `${c.concepto}: ${c.regla}` : undefined;
  };

  return {
    cliente: nombreCliente(cliente),
    fecha: hoy(),
    vigencia: `${CONDICIONES.vigenciaDias} días naturales`,
    lineas: conPrecio.map((l) => ({ sku: l.producto.sku, nombre: l.producto.nombre, detalle: l.detalle, mensual: l.mensual, unico: l.unico })),
    aparte: cotizacion.lineas
      .filter((l) => l.sinPrecio)
      .map((l) => ({
        nombre: l.producto.nombre,
        motivo:
          l.sinPrecio === 'arquitecto'
            ? 'Lo diseña un arquitecto de soluciones; se cotiza en una propuesta aparte.'
            : l.sinPrecio === 'consumo'
              ? `Se cobra según consumo (${l.detalle}).`
              : `Falta un dato para cotizarlo (${l.detalle}).`,
      })),
    subtotal: cotizacion.subtotal,
    descuentos,
    mensual: cotizacion.mensual,
    ivaPct: CONDICIONES.ivaPct,
    mensualConIva: cotizacion.mensualConIva,
    unico: cotizacion.unico,
    parcial: cotizacion.sinPrecio > 0,
    finanzas: [
      { concepto: 'Plazo del contrato', valor: `${cotizacion.plazo.meses} meses` },
      { concepto: 'Descuento total sobre lista', valor: `${cotizacion.descuentoTotalPct.toFixed(1)}%` },
      {
        concepto: 'Autorización',
        valor: cotizacion.rebasaTopeVendedor
          ? `Requiere gerente: pasa del ${CONDICIONES.topeVendedorPct}% que puede dar el vendedor`
          : `No requiere: dentro del ${CONDICIONES.topeVendedorPct}% del vendedor`,
      },
      { concepto: 'Mensualidad sin IVA', valor: `${moneda(cotizacion.mensual)} MXN` },
      { concepto: `Mensualidad con IVA (${CONDICIONES.ivaPct}%)`, valor: `${moneda(cotizacion.mensualConIva)} MXN` },
      { concepto: 'Cargos únicos sin IVA', valor: cotizacion.unico > 0 ? `${moneda(cotizacion.unico)} MXN` : 'Ninguno' },
      { concepto: 'Productos fuera de esta propuesta', valor: cotizacion.sinPrecio ? String(cotizacion.sinPrecio) : 'Ninguno' },
    ],
    condiciones: ['Moneda e IVA', 'Cargos únicos', 'Productos según consumo', 'Productos a la medida', 'Vigencia de la propuesta']
      .map(texto)
      .filter((t): t is string => Boolean(t)),
  };
}

const tablaMd = (encabezados: string[], filas: string[][]) =>
  [`| ${encabezados.join(' | ')} |`, `|${encabezados.map(() => '---').join('|')}|`, ...filas.map((f) => `| ${f.join(' | ')} |`)].join('\n');

export function briefMarkdown(b: Brief): string {
  return [
    `# Brief para IT · ${b.cliente}`,
    `**Resumen:** ${b.resumen}`,
    `**Tipo de caso y por qué entra IT:** ${b.tipoCaso}`,
    ...b.entraIT.map((e) => `- ${e.tema}: ${e.motivo} (${e.fuente})`),
    '## Requisitos',
    tablaMd(['Parámetro', 'Valor', 'Estado', 'Fuente'], b.requisitos.map((r) => [r.parametro, r.valor, r.estado, r.fuente])),
    '## Productos candidatos',
    tablaMd(['SKU', 'Producto', 'Tipo', 'Cantidad', 'Quién'], b.productos.map((p) => [p.sku, p.nombre, p.tipo, p.cantidad, p.quien])),
    '## Preguntas abiertas para el cliente',
    ...(b.preguntasAbiertas.length ? b.preguntasAbiertas.map((p) => `- ${p}`) : ['- Ninguna']),
    '## Contexto comercial',
    tablaMd(['Concepto', 'Valor', 'Estado', 'Fuente'], b.contextoComercial.map((r) => [r.parametro, r.valor, r.estado, r.fuente])),
    '## Lo que se le dijo al cliente',
    ...(b.loQueSeDijo.length ? b.loQueSeDijo.map((p) => `- ${p}`) : ['- Nada registrado']),
    `_Redactó: ${b.autor === 'Claude' ? 'Claude, con citas revisadas contra la transcripción' : 'el Traductor, con los datos de la llamada'}._`,
  ].join('\n\n');
}

export function propuestaMarkdown(p: Propuesta): string {
  return [
    `# Propuesta económica · ${p.cliente}`,
    `${p.fecha} · Vigencia: ${p.vigencia} · Precios en MXN del catálogo`,
    tablaMd(
      ['Producto', 'Detalle', 'Mensual', 'Cargo único'],
      p.lineas.map((l) => [`${l.nombre} (${l.sku})`, l.detalle, moneda(l.mensual), l.unico ? moneda(l.unico) : '—']),
    ),
    [
      `Subtotal mensual: ${moneda(p.subtotal)}`,
      ...p.descuentos.map((d) => `${d.concepto}: −${moneda(d.monto)}`),
      `**Mensualidad: ${moneda(p.mensual)} sin IVA · ${moneda(p.mensualConIva)} con IVA (${p.ivaPct}%)**`,
      p.unico ? `Cargos únicos: ${moneda(p.unico)} sin IVA` : null,
    ]
      .filter(Boolean)
      .join('  \n'),
    ...(p.aparte.length ? ['## Fuera de esta propuesta', ...p.aparte.map((a) => `- ${a.nombre}: ${a.motivo}`)] : []),
    '## Hoja para Finanzas',
    tablaMd(['Concepto', 'Valor'], p.finanzas.map((f) => [f.concepto, f.valor])),
    '## Condiciones',
    ...p.condiciones.map((c) => `- ${c}`),
  ].join('\n\n');
}
