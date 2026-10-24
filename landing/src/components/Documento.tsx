// Ventana con la propuesta o el brief para IT. Se puede copiar como Markdown o imprimir (y guardar como PDF):
// al imprimir solo sale el documento, no el tablero.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  briefBase,
  briefMarkdown,
  moneda,
  propuestaDe,
  propuestaMarkdown,
  type Brief,
  type EntradaDocumento,
  type EstadoDato,
  type Propuesta,
} from '../lib/documentos';
import { botonPrimario, botonTexto, MORADO_TEXTO, NARANJA_TEXTO, SECUNDARIO, SEPARADOR, TERCIARIO, TEXTO, VERDE_TEXTO } from './tema';

export type TipoDocumento = 'propuesta' | 'brief';

const COLOR_ESTADO: Record<EstadoDato, string> = { Confirmado: VERDE_TEXTO, Supuesto: NARANJA_TEXTO, Falta: MORADO_TEXTO };

const IMPRIMIR = `@media print {
  body * { visibility: hidden !important; }
  .documento-imprimible, .documento-imprimible * { visibility: visible !important; }
  .documento-imprimible { position: absolute !important; inset: 0 !important; overflow: visible !important; box-shadow: none !important; max-height: none !important; }
  .documento-sin-imprimir { display: none !important; }
}`;

export default function Documento({ tipo, entrada, alCerrar }: { tipo: TipoDocumento; entrada: EntradaDocumento; alCerrar: () => void }) {
  const [brief, setBrief] = useState<Brief>(() => briefBase(entrada));
  const [estado, setEstado] = useState<'redactando' | 'listo' | 'respaldo'>(tipo === 'brief' ? 'redactando' : 'listo');
  const [copiado, setCopiado] = useState(false);
  const propuesta = tipo === 'propuesta' ? propuestaDe(entrada) : null;

  // El brief sale al instante con lo que armó el código; Claude lo mejora si responde a tiempo.
  useEffect(() => {
    if (tipo !== 'brief') return;
    let vigente = true;
    const base = briefBase(entrada);
    fetch('/api/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base, transcripcion: entrada.conversacion }),
      signal: AbortSignal.timeout(40_000),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Brief;
      })
      .then((redactado) => {
        if (!vigente) return;
        setBrief(redactado);
        setEstado('listo');
      })
      .catch(() => vigente && setEstado('respaldo'));
    return () => {
      vigente = false;
    };
    // Se pide una vez al abrir; si la llamada sigue, se cierra y se vuelve a abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  const markdown = propuesta ? propuestaMarkdown(propuesta) : briefMarkdown(brief);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* sin portapapeles: queda imprimir */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={propuesta ? 'Propuesta económica' : 'Brief para IT'}
      onClick={alCerrar}
      style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'center', padding: '4vh 16px' }}
    >
      <style>{IMPRIMIR}</style>
      <div
        className="documento-imprimible"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(860px, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          color: TEXTO,
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          padding: '28px 32px',
        }}
      >
        <div className="documento-sin-imprimir" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: estado === 'respaldo' ? NARANJA_TEXTO : TERCIARIO }}>
            {propuesta
              ? 'Precios del catálogo, calculados por el cotizador'
              : estado === 'redactando'
                ? 'Claude está redactando el brief…'
                : estado === 'respaldo'
                  ? 'Claude no respondió: este brief lo armó el Traductor con los datos de la llamada'
                  : 'Redactado por Claude; cada dato confirmado tiene su cita en la llamada'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button style={botonTexto} onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar texto'}
            </button>
            <button style={botonTexto} onClick={() => window.print()}>
              Imprimir o guardar PDF
            </button>
            <button style={botonPrimario} onClick={alCerrar}>
              Cerrar
            </button>
          </span>
        </div>
        {propuesta ? <VistaPropuesta p={propuesta} /> : <VistaBrief b={brief} />}
      </div>
    </div>
  );
}

const h1: CSSProperties = { margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' };
const h2: CSSProperties = { margin: '22px 0 8px', fontSize: '1.02rem', fontWeight: 700 };
const celda: CSSProperties = { padding: '7px 8px', borderBottom: `1px solid ${SEPARADOR}`, textAlign: 'left', verticalAlign: 'top', fontSize: '0.86rem' };

function Tabla({ encabezados, filas, numericas = [] }: { encabezados: string[]; filas: ReactNode[][]; numericas?: number[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {encabezados.map((e, i) => (
            <th key={e} style={{ ...celda, color: SECUNDARIO, fontWeight: 600, textAlign: numericas.includes(i) ? 'right' : 'left' }}>
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i}>
            {f.map((c, j) => (
              <td key={j} style={{ ...celda, textAlign: numericas.includes(j) ? 'right' : 'left', fontVariantNumeric: numericas.includes(j) ? 'tabular-nums' : undefined }}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Lista = ({ items, vacio }: { items: string[]; vacio: string }) => (
  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', lineHeight: 1.5 }}>{items.length ? items.map((i) => <li key={i}>{i}</li>) : <li>{vacio}</li>}</ul>
);

const Estado = ({ estado }: { estado: EstadoDato }) => <b style={{ color: COLOR_ESTADO[estado], fontWeight: 600 }}>{estado}</b>;

function VistaBrief({ b }: { b: Brief }) {
  return (
    <>
      <h1 style={h1}>Brief para IT · {b.cliente}</h1>
      <p style={{ margin: '0 0 6px', fontSize: '0.95rem', lineHeight: 1.45 }}>
        <b>Resumen:</b> {b.resumen}
      </p>
      <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.45 }}>
        <b>Tipo de caso:</b> {b.tipoCaso}
      </p>
      {b.entraIT.length > 0 && (
        <Lista items={b.entraIT.map((e) => `${e.tema}: ${e.motivo} (${e.fuente})`)} vacio="" />
      )}
      <h2 style={h2}>Requisitos</h2>
      <Tabla encabezados={['Parámetro', 'Valor', 'Estado', 'Fuente']} filas={b.requisitos.map((r) => [r.parametro, r.valor, <Estado estado={r.estado} />, r.fuente])} />
      <h2 style={h2}>Productos candidatos</h2>
      <Tabla encabezados={['SKU', 'Producto', 'Tipo', 'Cantidad', 'Quién']} filas={b.productos.map((p) => [p.sku, p.nombre, p.tipo, p.cantidad, p.quien])} />
      <h2 style={h2}>Preguntas abiertas para el cliente</h2>
      <Lista items={b.preguntasAbiertas} vacio="Ninguna" />
      <h2 style={h2}>Contexto comercial</h2>
      <Tabla encabezados={['Concepto', 'Valor', 'Estado', 'Fuente']} filas={b.contextoComercial.map((r) => [r.parametro, r.valor, <Estado estado={r.estado} />, r.fuente])} />
      <h2 style={h2}>Lo que se le dijo al cliente</h2>
      <Lista items={b.loQueSeDijo} vacio="Nada registrado" />
    </>
  );
}

function VistaPropuesta({ p }: { p: Propuesta }) {
  return (
    <>
      <h1 style={h1}>Propuesta económica · {p.cliente}</h1>
      <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: SECUNDARIO }}>
        {p.fecha} · Vigencia: {p.vigencia} · Precios en MXN
      </p>
      <Tabla
        encabezados={['Producto', 'Detalle', 'Mensual', 'Cargo único']}
        numericas={[2, 3]}
        filas={p.lineas.map((l) => [l.nombre, l.detalle, moneda(l.mensual), l.unico ? moneda(l.unico) : '—'])}
      />
      <div style={{ marginTop: '12px', fontSize: '0.9rem', lineHeight: 1.6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <div>Subtotal mensual: {moneda(p.subtotal)}</div>
        {p.descuentos.map((d) => (
          <div key={d.concepto}>
            {d.concepto}: −{moneda(d.monto)}
          </div>
        ))}
        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px' }}>
          {moneda(p.mensual)} al mes sin IVA · {moneda(p.mensualConIva)} con IVA ({p.ivaPct}%)
        </div>
        {p.unico > 0 && <div>Cargos únicos: {moneda(p.unico)} sin IVA</div>}
        {p.parcial && <div style={{ color: NARANJA_TEXTO }}>Total parcial: hay productos fuera de esta propuesta.</div>}
      </div>
      {p.aparte.length > 0 && (
        <>
          <h2 style={h2}>Fuera de esta propuesta</h2>
          <Lista items={p.aparte.map((a) => `${a.nombre}: ${a.motivo}`)} vacio="" />
        </>
      )}
      <h2 style={h2}>Hoja para Finanzas</h2>
      <Tabla encabezados={['Concepto', 'Valor']} filas={p.finanzas.map((f) => [f.concepto, f.valor])} />
      <h2 style={h2}>Condiciones</h2>
      <Lista items={p.condiciones} vacio="" />
    </>
  );
}
