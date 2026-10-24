// Algoritmo de ayuda de IT: decide si el vendedor necesita a un ingeniero o arquitecto, y para qué exactamente.
// Es código determinista (no IA) para que cada decisión diga de dónde salió:
//   1. Junta las preguntas de la llamada (las que hace el cliente y las que el agente le sugiere al vendedor)
//      y marca cuáles son técnicas según un glosario. Si 6 de cada 10 o más son técnicas, hace falta IT.
//   2. Revisa cada producto detectado y cada regla ESC del catálogo: lo "a la medida", lo que cumple su condición
//      de "cuándo entra arquitecto" y cada regla activada SÍ es de IT; lo estándar o configurable NO, lo cotiza ventas.
//   3. Con eso da el tipo de caso: estándar (IT no entra), mixto (IT entra solo en una parte), a la medida (todo es de IT)
//      o por definir (todavía no hay ningún producto del catálogo).

export interface PreguntaLlamada {
  origen: 'cliente' | 'agente';
  texto: string;
  tecnica: boolean;
  /** La palabra del glosario que la hizo técnica o comercial, para explicarlo. */
  termino: string | null;
}

export interface ProductoDetectado {
  sku: string;
  estado: string;
}

export interface ProductoCatalogo {
  sku: string;
  nombre: string;
  tipo: string;
  cuando_entra_arquitecto: string | null;
}

export interface PuntoIT {
  tema: string;
  motivo: string;
  fuente: string;
}

export interface Ayuda {
  /** "por definir" mientras el agente no detecte ningún producto del catálogo. */
  tipoCaso: 'estándar' | 'mixto' | 'a la medida' | 'por definir';
  /** no: el vendedor solo · consulta: IT revisa el brief después · acompaña: IT entra a la siguiente sesión. */
  nivel: 'no' | 'consulta' | 'acompaña';
  necesitaIT: boolean;
  tecnicas: number;
  total: number;
  /** Lo que SÍ lleva a un ingeniero, con su motivo. */
  entra: PuntoIT[];
  /** Lo que NO necesita ingeniero: el vendedor lo resuelve con el catálogo. */
  noEntra: PuntoIT[];
  /** Una línea para el vendedor, en la voz A de notas/lenguaje-traductor.md. */
  aviso: string;
  preguntasTecnicas: string[];
}

/** De cada 10 preguntas, cuántas tienen que ser técnicas para pedir apoyo de IT, y cuántas preguntas como mínimo. */
export const UMBRAL_TECNICO = 0.6;
export const MINIMO_PREGUNTAS = 3;

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Misma pregunta aunque cambien acentos, mayúsculas o signos: así no se cuenta dos veces. */
export const claveDePregunta = (texto: string) => normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim();

// Glosario: términos de IT del catálogo y de notas/lenguaje-traductor.md. Se buscan como palabra completa.
const TECNICOS = [
  'rpo', 'rto', 'latencia', 'ancho de banda', 'mbps', 'gbps', 'vcpu', 'cpu', 'nucleos', 'ram', 'disco', 'ssd', 'tb', 'gb',
  'servidor', 'servidores', 'rack', 'racks', 'kva', 'colocation', 'data center', 'centro de datos', 'site', 'maquina virtual',
  'virtualizar', 'vm', 'nube', 'aws', 'azure', 'oci', 'oracle', 'base de datos', 'bases de datos', 'sql', 'rac', 'data guard',
  'migrar', 'migracion', 'mudar', 'integrar', 'integracion', 'conectar', 'api', 'erp', 'crm', 'sap', 'jd edwards',
  'vpn', 'firewall', 'cifrado', 'cifrar', 'ransomware', 'respaldo', 'respaldos', 'backup', 'inmutable', 'retencion',
  'replica', 'recuperacion ante desastres', 'plan b', 'alta disponibilidad', 'disponibilidad', 'sla', 'redundancia',
  'enlace', 'fibra', 'sd-wan', 'mpls', 'red', 'switch', 'gpu', 'escritorio virtual', 'escritorios virtuales',
  'cnbv', 'nom', 'datos personales', 'datos de salud', 'expediente clinico', 'pci', 'cumplir', 'cumplimiento', 'regulacion',
  'kubernetes', 'contenedores', 'hibrida', 'hibrido', 'sharepoint', 'permisos', 'active directory', 'sso', 'landing zone',
  'licencias mezcladas', 'dba', 'monitoreo', 'parches', 'seguridad',
];
const COMERCIALES = [
  'precio', 'costo', 'cuesta', 'cuanto sale', 'descuento', 'plazo', 'contrato', 'factura', 'facturar', 'pago', 'pagar',
  'mensualidad', 'propuesta', 'presupuesto', 'iva', 'cotizacion', 'cotizar', 'promocion', 'meses sin intereses',
];
const PALABRAS_DE_PREGUNTA = /^(que|como|cuanto|cuantos|cuantas|cual|cuales|cuando|donde|se puede|pueden|puedo|es posible|tienen|incluye|sirve)\b/;

const buscar = (texto: string, lista: string[]) => {
  const t = ` ${normalizar(texto).replace(/[^a-z0-9-]+/g, ' ')} `;
  return lista.find((termino) => t.includes(` ${termino} `)) ?? null;
};

/** Técnica si menciona algo del glosario de IT; si solo habla de precio o plazo es comercial. */
export function clasificar(texto: string): { tecnica: boolean; termino: string | null } {
  const tecnico = buscar(texto, TECNICOS);
  if (tecnico) return { tecnica: true, termino: tecnico };
  return { tecnica: false, termino: buscar(texto, COMERCIALES) };
}

/** Las preguntas que hizo el cliente: frases con "?" o que empiezan como pregunta. */
export function preguntasDelCliente(transcripcion: { quien: string; texto: string }[]): PreguntaLlamada[] {
  return transcripcion
    .filter((t) => /cliente/i.test(t.quien))
    .flatMap((t) => t.texto.split(/(?<=[.?!])\s+/))
    .map((frase) => frase.trim())
    .filter((frase) => frase.length > 8 && (frase.includes('?') || PALABRAS_DE_PREGUNTA.test(normalizar(frase).replace(/^[¿¡\s]+/, ''))))
    .map((texto) => ({ origen: 'cliente' as const, texto, ...clasificar(texto) }));
}

export function preguntaDelAgente(texto: string | null | undefined): PreguntaLlamada[] {
  return texto ? [{ origen: 'agente', texto, ...clasificar(texto) }] : [];
}

export function evaluar(
  preguntas: PreguntaLlamada[],
  productos: ProductoDetectado[],
  reglas: { id: string; texto: string }[],
  catalogo: Map<string, ProductoCatalogo>,
): Ayuda {
  const entra: PuntoIT[] = [];
  const noEntra: PuntoIT[] = [];

  for (const detectado of productos) {
    if (detectado.estado === 'sugerido') continue;
    const p = catalogo.get(detectado.sku);
    if (!p) continue;
    if (p.tipo === 'a la medida') {
      entra.push({ tema: p.nombre, motivo: 'Es a la medida: no tiene precio de lista, lo diseña un arquitecto.', fuente: `${p.sku} · regla ESC-01` });
    } else if (detectado.estado === 'arquitecto') {
      entra.push({ tema: p.nombre, motivo: `Pasa el límite estándar: ${p.cuando_entra_arquitecto ?? 'condición del catálogo'}.`, fuente: p.sku });
    } else {
      const como = p.tipo === 'configurable' ? 'Configurable: lo cotizas tú en cuanto tengas la cantidad.' : 'Estándar: lo cotizas tú con el precio de lista.';
      noEntra.push({ tema: p.nombre, motivo: como, fuente: p.sku });
    }
  }
  for (const r of reglas) {
    if (r.id === 'ESC-01') continue; // ya quedó dicho en el producto a la medida
    entra.push({ tema: `Regla ${r.id}`, motivo: r.texto, fuente: `Reglas de escalamiento · ${r.id}` });
  }

  // Cada pregunta cuenta una vez, aunque el agente la sugiera en varios turnos.
  const unicas = [...new Map(preguntas.map((p) => [claveDePregunta(p.texto), p])).values()];
  const tecnicas = unicas.filter((p) => p.tecnica);
  const total = unicas.length;
  const muyTecnica = total >= MINIMO_PREGUNTAS && tecnicas.length / total >= UMBRAL_TECNICO;
  if (muyTecnica) {
    entra.push({
      tema: 'Conversación técnica',
      motivo: `${tecnicas.length} de ${total} preguntas son técnicas (${tecnicas.map((p) => p.termino).filter(Boolean).slice(0, 4).join(', ')}).`,
      fuente: `Algoritmo de ayuda · umbral ${Math.round(UMBRAL_TECNICO * 10)}/10`,
    });
  }
  const comerciales = unicas.filter((p) => !p.tecnica && p.termino);
  if (comerciales.length) {
    noEntra.push({ tema: 'Precio, plazo y propuesta', motivo: 'Son preguntas comerciales: las respondes tú con las condiciones del catálogo.', fuente: 'Condiciones comerciales' });
  }

  // Una conversación muy técnica también saca al caso de lo estándar, aunque no haya producto a la medida.
  // Es "a la medida" cuando no queda nada estándar, o cuando lo especializado viene a la vez de un producto
  // y de una regla ESC (ej. migración a la medida + datos de salud): ahí el arquitecto diseña toda la solución.
  // Si viene de un solo lado, es "mixto": IT ve esa parte y el vendedor cotiza el resto.
  const conArquitecto = entra.length > 0;
  const porProducto = entra.some((e) => e.fuente.startsWith('SIM-'));
  const porRegla = entra.some((e) => e.tema.startsWith('Regla '));
  const hayEstandar = noEntra.some((n) => n.fuente.startsWith('SIM-'));
  const sinProductos = !productos.some((p) => p.estado !== 'sugerido');
  const tipoCaso: Ayuda['tipoCaso'] = sinProductos
    ? 'por definir'
    : !conArquitecto
      ? 'estándar'
      : !hayEstandar || (porProducto && porRegla)
        ? 'a la medida'
        : 'mixto';
  const necesitaIT = entra.length > 0;
  const nivel: Ayuda['nivel'] = !necesitaIT ? 'no' : tipoCaso === 'a la medida' || muyTecnica ? 'acompaña' : 'consulta';

  const aviso =
    nivel === 'no'
      ? 'Lo resuelves tú: todo sale del catálogo estándar.'
      : nivel === 'consulta'
        ? `Sigue tú con lo estándar; ${entra.length === 1 ? 'un punto' : `${entra.length} puntos`} los revisa IT con el brief.`
        : muyTecnica
          ? `Pide apoyo de IT: ${tecnicas.length} de ${total} preguntas son técnicas.`
          : 'Pide apoyo de IT: el caso es a la medida y lo diseña un arquitecto.';

  return {
    tipoCaso,
    nivel,
    necesitaIT,
    tecnicas: tecnicas.length,
    total,
    entra,
    noEntra,
    aviso,
    preguntasTecnicas: tecnicas.map((p) => p.texto).slice(0, 10),
  };
}
