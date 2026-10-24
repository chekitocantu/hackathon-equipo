// El Traductor (ver notas/lenguaje-traductor.md): tres agentes, uno por área, que corren en paralelo al terminar la llamada.
// Cada uno recibe el mismo contexto (transcripción, perfil, productos, reglas y números del cotizador) y lo cuenta en su idioma.
// Los números los pone el cotizador; aquí el modelo solo los explica.
import type { EntradaTraductor, EstadoRequisito, ReporteFinanzas, ReporteIT, ReporteVentas } from '../src/lib/traductor.ts';

interface CatalogoTraductor {
  productos: { sku: string; nombre: string; tipo: string; cuando_entra_arquitecto: string | null }[];
  reglas_escalamiento: { id: string; cuando_entra_un_arquitecto: string }[];
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('en-US')} MXN`;

/** Todo lo que se sabe de la llamada, en texto, igual para los tres agentes. */
export function contextoTraductor(entrada: EntradaTraductor, catalogo: CatalogoTraductor) {
  const productos = new Map(catalogo.productos.map((p) => [p.sku, p]));
  const reglas = new Map(catalogo.reglas_escalamiento.map((r) => [r.id, r.cuando_entra_un_arquitecto]));
  const n = entrada.numeros;

  const lineasProductos = entrada.productos
    .filter((p) => productos.has(p.sku))
    .map((p) => {
      const c = productos.get(p.sku)!;
      return `- ${p.sku} ${c.nombre} · tipo ${c.tipo} · estado ${p.estado}${p.cantidad ? ` · cantidad ${p.cantidad}` : ''}${p.nota ? ` · ${p.nota}` : ''}`;
    });

  return [
    `Empresa: ${entrada.empresa ?? 'sin nombre'}`,
    entrada.perfil ? `PERFIL DEL CLIENTE (fase 1 de la llamada):\n${entrada.perfil}` : 'PERFIL DEL CLIENTE: no se capturó.',
    `PRODUCTOS DEL CATÁLOGO DETECTADOS:\n${lineasProductos.join('\n') || '- ninguno'}`,
    `REGLAS DE ESCALAMIENTO ACTIVAS:\n${entrada.reglas.map((id) => `- ${id}: ${reglas.get(id) ?? ''}`).join('\n') || '- ninguna'}`,
    `DATOS PARA COTIZAR:\n${entrada.datos.map((d) => `- ${d.etiqueta}: ${d.valor ?? 'Falta'}`).join('\n') || '- ninguno'}`,
    `NÚMEROS DEL TRATO (calculados por el cotizador con la lista de precios; no los cambies ni calcules otros):
- Plazo: ${n.plazoMeses} meses
- Mensualidad: ${pesos(n.mensual)} sin IVA (${pesos(n.mensualConIva)} con IVA)
- Cargos únicos: ${pesos(n.unico)}
- Valor total del contrato: ${pesos(n.valorContrato)} sin IVA
- Precio de lista antes de descuentos: ${pesos(n.subtotal)} al mes
- Descuento por paquete: ${n.descuentoPaquete ? `${n.descuentoPaquete.nombre}, ${n.descuentoPaquete.pct}% (${pesos(n.descuentoPaquete.monto)} al mes)` : 'no aplica'}
- Descuento por plazo: ${n.descuentoPlazo.pct}% (${pesos(n.descuentoPlazo.monto)} al mes)
- Descuento total: ${n.descuentoTotalPct.toFixed(1)}%; tope del vendedor sin autorización: ${n.topeVendedorPct}%${n.rebasaTopeVendedor ? ' (REBASA EL TOPE: requiere autorización del gerente)' : ''}
- Sin precio todavía (los diseña un arquitecto o falta un dato): ${n.sinPrecio.join(', ') || 'nada'}
- Presupuesto que mencionó el cliente: ${n.presupuestoCliente ?? 'no lo dijo'}
- El catálogo no trae costos, así que el margen o la ganancia NO se pueden calcular.`,
    `TRANSCRIPCIÓN:\n${entrada.transcripcion.slice(-150).map((t) => `${t.quien}: ${t.texto}`).join('\n') || '(vacía)'}`,
  ].join('\n\n');
}

const REGLAS_COMUNES = `Reglas para todas las áreas:
- No inventes. Todo sale de la transcripción, del perfil o del catálogo. Si algo no está, dilo ("Falta" o null).
- Nunca pongas un número que no esté arriba: los precios y descuentos ya los calculó el cotizador.
- Separa lo que el cliente dijo de lo que tú deduces.
- Todo en español de México. Devuelve solo un objeto JSON, sin texto antes ni después.`;

export function promptsTraductor(guia: string) {
  const conGuia = guia ? `\n\nGuía de lenguaje del equipo (síguela):\n${guia}` : '';

  const ventas = `Eres el Traductor de una empresa de soluciones de TI. Al terminar una videollamada de venta, le escribes al ÁREA DE VENTAS
el retrato del cliente: quién es, qué le duele, cómo piensa y cómo hablarle. Tono de coach comercial: claro, directo, sin siglas técnicas.

Devuelve este JSON:
{
  "perfil": "quién es el cliente en máximo 2 frases",
  "dolor": [{ "texto": "un dolor del cliente en sus palabras", "cita": "frase textual de la transcripción o null" }],
  "motivadores": ["qué lo mueve a comprar: miedo, urgencia, ahorro, cumplir una regla, crecer…"],
  "objeciones": [{ "objecion": "lo que probablemente diga para no comprar", "respuesta": "cómo responderle, máximo 25 palabras" }],
  "comoHablarle": "cómo hablarle según su nivel técnico y su forma de expresarse, máximo 2 frases",
  "decide": "quién decide la compra o null",
  "cuando": "para cuándo lo necesita o null",
  "siguientePaso": "la siguiente acción concreta del vendedor",
  "prometido": ["lo que el vendedor ya le dijo o prometió al cliente"]
}
Máximo 4 elementos en cada lista.

${REGLAS_COMUNES}${conGuia}`;

  const it = `Eres el Traductor de una empresa de soluciones de TI. Al terminar una videollamada de venta, le escribes al ÁREA DE IT
(arquitectos e ingenieros) el brief técnico de la solución. Tono de colega técnico: seco y preciso, con unidades completas,
sin adjetivos de venta. Usa la "voz C" de la guía.

Devuelve este JSON:
{
  "resumen": "una línea: giro, tamaño, ciudad si se sabe, problema técnico",
  "porQueArquitecto": "si entra arquitecto y por qué (reglas ESC o condición del producto), o que no hace falta",
  "requisitos": [{ "parametro": "ej. Usuarios, Volumen de datos, RTO, Sucursales, Regulación", "valor": "valor con unidad o null", "estado": "Confirmado | Supuesto | Falta", "fuente": "cita corta del cliente, 'Perfil' o el porqué del supuesto" }],
  "preguntasAbiertas": ["preguntas técnicas que faltan, en lenguaje de IT"],
  "prometido": ["lo que el vendedor ya le dijo al cliente, para que IT no lo contradiga"]
}
Máximo 8 requisitos y 5 preguntas.

${REGLAS_COMUNES}${conGuia}`;

  const finanzas = `Eres el Traductor de una empresa de soluciones de TI. Al terminar una videollamada de venta, le explicas al ÁREA DE FINANZAS
los números del trato. Tono de analista: breve, con cifras exactas copiadas de "NÚMEROS DEL TRATO".
No calcules números nuevos. El margen y la ganancia no se pueden saber porque el catálogo no trae costos: si lo mencionas, dilo así.

Devuelve este JSON:
{
  "lectura": "cómo leer este trato en máximo 3 frases: ingreso mensual, valor del contrato y qué falta por cotizar",
  "riesgos": ["riesgos financieros: descuento arriba del tope, partes sin precio, presupuesto del cliente por debajo, plazo corto…"],
  "recomendacion": "qué debería hacer Finanzas o el gerente, máximo 2 frases"
}
Máximo 4 riesgos.

${REGLAS_COMUNES}`;

  return { ventas, it, finanzas };
}

const texto = (x: unknown, max: number) => (typeof x === 'string' && x.trim() && x.trim() !== 'null' ? x.trim().slice(0, max) : null);
const lista = (x: unknown) => (Array.isArray(x) ? (x as unknown[]) : []);
const textos = (x: unknown, max: number, cuantos: number) =>
  lista(x)
    .map((t) => texto(t, max))
    .filter((t): t is string => !!t)
    .slice(0, cuantos);
const objeto = (x: unknown) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});

export function validarVentas(crudo: Record<string, unknown>): ReporteVentas {
  return {
    perfil: texto(crudo.perfil, 300),
    dolor: lista(crudo.dolor)
      .map(objeto)
      .map((d) => ({ texto: texto(d.texto, 200) ?? '', cita: texto(d.cita, 220) }))
      .filter((d) => d.texto)
      .slice(0, 4),
    motivadores: textos(crudo.motivadores, 160, 4),
    objeciones: lista(crudo.objeciones)
      .map(objeto)
      .map((o) => ({ objecion: texto(o.objecion, 160) ?? '', respuesta: texto(o.respuesta, 220) ?? '' }))
      .filter((o) => o.objecion)
      .slice(0, 4),
    comoHablarle: texto(crudo.comoHablarle, 300),
    decide: texto(crudo.decide, 160),
    cuando: texto(crudo.cuando, 160),
    siguientePaso: texto(crudo.siguientePaso, 240),
    prometido: textos(crudo.prometido, 200, 4),
  };
}

const ESTADOS: EstadoRequisito[] = ['Confirmado', 'Supuesto', 'Falta'];

export function validarIT(crudo: Record<string, unknown>): ReporteIT {
  return {
    resumen: texto(crudo.resumen, 300),
    porQueArquitecto: texto(crudo.porQueArquitecto, 400),
    requisitos: lista(crudo.requisitos)
      .map(objeto)
      .map((r) => ({
        parametro: texto(r.parametro, 80) ?? '',
        valor: texto(r.valor, 160),
        estado: ESTADOS.find((e) => e === r.estado) ?? (texto(r.valor, 160) ? 'Supuesto' : 'Falta'),
        fuente: texto(r.fuente, 200),
      }))
      .filter((r) => r.parametro)
      .slice(0, 8),
    preguntasAbiertas: textos(crudo.preguntasAbiertas, 220, 5),
    prometido: textos(crudo.prometido, 200, 4),
  };
}

export function validarFinanzas(crudo: Record<string, unknown>): ReporteFinanzas {
  return {
    lectura: texto(crudo.lectura, 500),
    riesgos: textos(crudo.riesgos, 240, 4),
    recomendacion: texto(crudo.recomendacion, 300),
  };
}
