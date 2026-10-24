// El Traductor: al terminar la llamada, la misma conversación para Ventas, IT y Finanzas, cada una en su idioma.
// Los textos los escribe Claude (server/traductor.ts) siguiendo notas/lenguaje-traductor.md;
// las cifras de Finanzas y la lista de productos salen del cotizador y del catálogo, nunca del modelo.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import MapaSoluciones from './MapaSoluciones';
import { Segmentado } from './Tablero';
import {
  AZUL,
  AZUL_TEXTO,
  botonPrimario,
  botonTexto,
  moneda,
  MORADO_TEXTO,
  NARANJA,
  NARANJA_TEXTO,
  ROJO,
  SECUNDARIO,
  SEPARADOR,
  tarjeta,
  TERCIARIO,
  TEXTO,
  tituloTarjeta,
  VERDE,
  VERDE_TEXTO,
} from './tema';
import { CONDICIONES, producto, regla } from '../lib/catalogo';
import { cotizar, type Cotizacion, type ProductoEnEtapa } from '../lib/cotizador';
import { perfilComoTexto, type NivelTecnico, type Perfil } from '../lib/perfil';
import type { EntradaTraductor, NumerosTrato, Traduccion } from '../lib/traductor';

const AREAS = ['Ventas', 'IT', 'Finanzas'] as const;
const PLAZOS = [12, 24, 36];

const NIVEL: Record<NivelTecnico, { color: string; texto: string }> = {
  básico: { color: VERDE, texto: 'Básico' },
  intermedio: { color: NARANJA, texto: 'Intermedio' },
  avanzado: { color: AZUL, texto: 'Avanzado' },
};

interface TraductorProps {
  empresa: string | null;
  productos: ProductoEnEtapa[];
  reglas: string[];
  datos: { etiqueta: string; valor: string | null }[];
  perfil: Perfil;
  conversacion: { quien: string; texto: string }[];
}

/** Los números del trato salen del mismo cotizador que el tablero. */
function numerosDelTrato(cotizacion: Cotizacion, plazo: number, perfil: Perfil): NumerosTrato {
  return {
    plazoMeses: plazo,
    mensual: cotizacion.mensual,
    mensualConIva: cotizacion.mensualConIva,
    unico: cotizacion.unico,
    valorContrato: cotizacion.mensual * plazo + cotizacion.unico,
    subtotal: cotizacion.subtotal,
    descuentoPaquete: cotizacion.paquete
      ? { nombre: cotizacion.paquete.paquete.nombre, pct: cotizacion.paquete.paquete.descuento_pct, monto: cotizacion.paquete.monto }
      : null,
    descuentoPlazo: { pct: cotizacion.plazo.pct, monto: cotizacion.plazo.monto },
    descuentoTotalPct: cotizacion.descuentoTotalPct,
    rebasaTopeVendedor: cotizacion.rebasaTopeVendedor,
    topeVendedorPct: CONDICIONES.topeVendedorPct,
    sinPrecio: cotizacion.lineas.filter((l) => l.sinPrecio).map((l) => `${l.producto.nombre} (${l.detalle})`),
    presupuestoCliente: perfil.respuestas.D3 ?? null,
  };
}

export default function Traductor({ empresa, productos, reglas, datos, perfil, conversacion }: TraductorProps) {
  const [area, setArea] = useState(0);
  const [plazo, setPlazo] = useState(12);
  const [plazoTraducido, setPlazoTraducido] = useState(12);
  const [traduccion, setTraduccion] = useState<Traduccion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cotizacion = cotizar(productos, plazo);
  const numeros = numerosDelTrato(cotizacion, plazo, perfil);

  async function traducir() {
    setCargando(true);
    setError(null);
    const entrada: EntradaTraductor = {
      transcripcion: conversacion,
      perfil: perfilComoTexto(perfil),
      empresa,
      productos,
      reglas,
      datos,
      numeros,
    };
    try {
      const respuesta = await fetch('/api/traducir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada),
      });
      const json = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(json.error ?? `Error ${respuesta.status}`);
      setTraduccion(json as Traduccion);
      setPlazoTraducido(plazo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  // Se traduce una vez al abrir; después, solo si el vendedor lo pide.
  useEffect(() => {
    void traducir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copiar() {
    const texto = [comoTextoVentas, comoTextoIT, comoTextoFinanzas][area](traduccion, { productos, numeros, perfil, empresa });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setError('El navegador no dejó copiar; selecciona el texto a mano.');
    }
  }

  const errorDelArea = traduccion?.errores.find((e) => e.startsWith(AREAS[area]));

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ width: 'min(460px, 100%)' }}>
          <Segmentado
            etiqueta="Área"
            elegido={area}
            alElegir={setArea}
            opciones={[
              { id: 'ventas', titulo: 'Ventas', sub: 'Perfil y psicología' },
              { id: 'it', titulo: 'IT', sub: 'Infraestructura' },
              { id: 'finanzas', titulo: 'Finanzas', sub: 'Números del trato' },
            ]}
          />
        </div>
        <span style={{ fontSize: '0.85rem', color: SECUNDARIO }}>La misma llamada, en el idioma de cada área.</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {error && <span style={{ fontSize: '0.82rem', color: ROJO, maxWidth: '320px' }}>{error}</span>}
          <button style={{ ...botonTexto, opacity: cargando ? 0.5 : 1 }} disabled={cargando} onClick={() => void traducir()}>
            Volver a traducir
          </button>
          <button style={{ ...botonPrimario, opacity: cargando || !traduccion ? 0.5 : 1 }} disabled={cargando || !traduccion} onClick={() => void copiar()}>
            {copiado ? 'Copiado' : `Copiar para ${AREAS[area]}`}
          </button>
        </div>
      </div>

      <section style={{ ...tarjeta, flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 28px' }}>
        {cargando && !traduccion ? (
          <div role="status" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <Girando tamano={30} />
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Traduciendo la llamada para Ventas, IT y Finanzas…</span>
            <span style={{ fontSize: '0.9rem', color: TERCIARIO }}>Tres agentes trabajan en paralelo; tarda unos segundos.</span>
          </div>
        ) : (
          <>
            {cargando && (
              <p style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: SECUNDARIO }}>
                <Girando tamano={12} /> Actualizando la traducción…
              </p>
            )}
            {errorDelArea && <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: ROJO }}>{errorDelArea}</p>}
            {area === 0 && <VistaVentas reporte={traduccion?.ventas ?? null} perfil={perfil} />}
            {area === 1 && <VistaIT reporte={traduccion?.it ?? null} productos={productos} reglas={reglas} />}
            {area === 2 && (
              <VistaFinanzas
                reporte={traduccion?.finanzas ?? null}
                cotizacion={cotizacion}
                numeros={numeros}
                plazo={plazo}
                setPlazo={setPlazo}
                plazoTraducido={plazoTraducido}
                actualizarLectura={() => void traducir()}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── Ventas: quién es el cliente, qué le duele, cómo piensa y cómo hablarle ──

function VistaVentas({ reporte, perfil }: { reporte: Traduccion['ventas']; perfil: Perfil }) {
  if (!reporte) return <SinReporte />;
  return (
    <div style={columnas}>
      <div style={columna}>
        <Bloque titulo="Quién es">
          <p style={parrafo}>{reporte.perfil ?? 'Sin datos suficientes.'}</p>
          {perfil.nivel && (
            <p style={{ ...parrafo, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: NIVEL[perfil.nivel].color }} />
              Nivel técnico <b style={{ color: TEXTO }}>{NIVEL[perfil.nivel].texto}</b>
            </p>
          )}
        </Bloque>
        <Bloque titulo="Su dolor, con sus palabras">
          {reporte.dolor.length === 0 && <Vacio />}
          {reporte.dolor.map((d) => (
            <div key={d.texto} style={{ padding: '8px 0', borderBottom: `1px solid ${SEPARADOR}` }}>
              <div style={{ fontSize: '0.98rem', color: TEXTO }}>{d.texto}</div>
              {d.cita && <div style={{ fontSize: '0.88rem', color: SECUNDARIO, marginTop: '2px', fontStyle: 'italic' }}>“{d.cita}”</div>}
            </div>
          ))}
        </Bloque>
        <Bloque titulo="Qué lo mueve a comprar">
          <Etiquetas items={reporte.motivadores} color={AZUL_TEXTO} fondo="#eaf7ff" />
        </Bloque>
        <Bloque titulo="Cómo hablarle">
          <p style={parrafo}>{reporte.comoHablarle ?? 'Sin datos suficientes.'}</p>
        </Bloque>
      </div>
      <div style={columna}>
        <Bloque titulo="Siguiente paso" destacado>
          <p style={{ ...parrafo, color: TEXTO, fontWeight: 600 }}>{reporte.siguientePaso ?? 'Sin definir.'}</p>
        </Bloque>
        <Bloque titulo="Objeciones probables">
          {reporte.objeciones.length === 0 && <Vacio />}
          {reporte.objeciones.map((o) => (
            <div key={o.objecion} style={{ padding: '8px 0', borderBottom: `1px solid ${SEPARADOR}` }}>
              <div style={{ fontSize: '0.95rem', color: TEXTO }}>“{o.objecion}”</div>
              <div style={{ fontSize: '0.88rem', color: VERDE_TEXTO, marginTop: '2px' }}>Responde: {o.respuesta}</div>
            </div>
          ))}
        </Bloque>
        <Bloque titulo="Decisión">
          <Par etiqueta="Quién decide" valor={reporte.decide} />
          <Par etiqueta="Para cuándo" valor={reporte.cuando} />
        </Bloque>
        <Bloque titulo="Ya se le dijo al cliente">
          <Lista items={reporte.prometido} />
        </Bloque>
      </div>
    </div>
  );
}

// ── IT: la infraestructura de la solución ──

const COLOR_ESTADO = { Confirmado: VERDE_TEXTO, Supuesto: NARANJA_TEXTO, Falta: ROJO } as const;

function VistaIT({ reporte, productos, reglas }: { reporte: Traduccion['it']; productos: ProductoEnEtapa[]; reglas: string[] }) {
  const activos = productos.filter((p) => p.estado !== 'sugerido');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={columnas}>
        <Bloque titulo="Resumen técnico">
          <p style={parrafo}>{reporte?.resumen ?? 'Sin resumen todavía.'}</p>
        </Bloque>
        <Bloque titulo="¿Entra arquitecto?">
          <p style={parrafo}>{reporte?.porQueArquitecto ?? 'Sin evaluar.'}</p>
          {reglas.map((id) => (
            <p key={id} style={{ ...parrafo, fontSize: '0.85rem', marginTop: '4px' }}>
              <b style={{ color: MORADO_TEXTO }}>{id}</b> · {regla(id)}
            </p>
          ))}
        </Bloque>
      </div>

      <Bloque titulo="Infraestructura de la solución">
        <div style={{ position: 'relative', height: '230px' }}>
          <MapaSoluciones productos={productos} />
        </div>
        <table style={tabla}>
          <thead>
            <tr>
              {['SKU', 'Producto', 'Tipo', 'Cantidad', 'Estado'].map((c) => (
                <th key={c} style={celdaTitulo}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activos.map((p) => {
              const c = producto(p.sku);
              return (
                <tr key={p.sku}>
                  <td style={{ ...celda, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{p.sku}</td>
                  <td style={celda}>{c.nombre}</td>
                  <td style={celda}>{c.tipo}</td>
                  <td style={celda}>{p.cantidad ?? p.nota ?? '—'}</td>
                  <td style={celda}>{p.estado}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Bloque>

      {!reporte ? (
        <SinReporte />
      ) : (
        <>
          <Bloque titulo="Requisitos">
            <table style={tabla}>
              <thead>
                <tr>
                  {['Parámetro', 'Valor', 'Estado', 'Fuente'].map((c) => (
                    <th key={c} style={celdaTitulo}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reporte.requisitos.map((r) => (
                  <tr key={r.parametro}>
                    <td style={{ ...celda, fontWeight: 600 }}>{r.parametro}</td>
                    <td style={celda}>{r.valor ?? '—'}</td>
                    <td style={{ ...celda, color: COLOR_ESTADO[r.estado], fontWeight: 600 }}>{r.estado}</td>
                    <td style={{ ...celda, color: SECUNDARIO }}>{r.fuente ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloque>
          <div style={columnas}>
            <Bloque titulo="Preguntas técnicas pendientes">
              <Lista items={reporte.preguntasAbiertas} />
            </Bloque>
            <Bloque titulo="Lo que ya se le dijo al cliente">
              <Lista items={reporte.prometido} />
            </Bloque>
          </div>
        </>
      )}
    </div>
  );
}

// ── Finanzas: los números del trato (del cotizador) y su lectura (del modelo) ──

function VistaFinanzas({
  reporte,
  cotizacion,
  numeros,
  plazo,
  setPlazo,
  plazoTraducido,
  actualizarLectura,
}: {
  reporte: Traduccion['finanzas'];
  cotizacion: Cotizacion;
  numeros: NumerosTrato;
  plazo: number;
  setPlazo: (p: number) => void;
  plazoTraducido: number;
  actualizarLectura: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem', color: SECUNDARIO }}>Plazo del contrato</span>
        <div style={{ width: '280px' }}>
          <Segmentado
            etiqueta="Plazo"
            compacto
            elegido={PLAZOS.indexOf(plazo)}
            alElegir={(i) => setPlazo(PLAZOS[i])}
            opciones={PLAZOS.map((m) => ({ id: String(m), titulo: `${m} meses` }))}
          />
        </div>
        <span style={{ fontSize: '0.8rem', color: TERCIARIO }}>MXN · precios del catálogo simulado</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <Metrica titulo="Ingreso mensual" valor={moneda(numeros.mensual)} detalle="sin IVA" />
        <Metrica titulo="Con IVA" valor={moneda(numeros.mensualConIva)} detalle={`IVA ${CONDICIONES.ivaPct}%`} />
        <Metrica titulo="Cargos únicos" valor={moneda(numeros.unico)} detalle="instalación y migración" />
        <Metrica titulo="Valor del contrato" valor={moneda(numeros.valorContrato)} detalle={`${plazo} meses + cargos únicos`} />
        <Metrica titulo="Margen" valor="Falta el costo" detalle="el catálogo solo trae precios de venta" tenue />
      </div>

      {numeros.rebasaTopeVendedor && (
        <p style={{ margin: 0, fontSize: '0.92rem', color: NARANJA_TEXTO }}>
          Descuento total de {Math.round(numeros.descuentoTotalPct)}%: rebasa el {numeros.topeVendedorPct}% que puede dar el vendedor; requiere autorización del gerente.
        </p>
      )}

      <Bloque titulo="Desglose">
        <table style={tabla}>
          <tbody>
            {cotizacion.lineas.map((l) => (
              <tr key={l.producto.sku}>
                <td style={celda}>{l.producto.nombre}</td>
                <td style={{ ...celda, color: SECUNDARIO }}>{l.detalle}</td>
                <td style={{ ...celda, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: l.sinPrecio ? NARANJA_TEXTO : TEXTO }}>
                  {l.sinPrecio ? 'Sin precio' : l.mensual > 0 ? `${moneda(l.mensual)} / mes` : `${moneda(l.unico)} único`}
                </td>
              </tr>
            ))}
            {numeros.descuentoPaquete && (
              <tr>
                <td style={{ ...celda, color: VERDE_TEXTO }}>Paquete «{numeros.descuentoPaquete.nombre}»</td>
                <td style={{ ...celda, color: SECUNDARIO }}>{numeros.descuentoPaquete.pct}%</td>
                <td style={{ ...celda, textAlign: 'right', color: VERDE_TEXTO, fontWeight: 600 }}>−{moneda(numeros.descuentoPaquete.monto)} / mes</td>
              </tr>
            )}
            {numeros.descuentoPlazo.monto > 0 && (
              <tr>
                <td style={{ ...celda, color: VERDE_TEXTO }}>Plazo de {plazo} meses</td>
                <td style={{ ...celda, color: SECUNDARIO }}>{numeros.descuentoPlazo.pct}%</td>
                <td style={{ ...celda, textAlign: 'right', color: VERDE_TEXTO, fontWeight: 600 }}>−{moneda(numeros.descuentoPlazo.monto)} / mes</td>
              </tr>
            )}
          </tbody>
        </table>
        {numeros.presupuestoCliente && (
          <p style={{ ...parrafo, marginTop: '10px' }}>
            Presupuesto que mencionó el cliente: <b style={{ color: TEXTO }}>{numeros.presupuestoCliente}</b>
          </p>
        )}
      </Bloque>

      {plazo !== plazoTraducido && (
        <p style={{ margin: 0, fontSize: '0.88rem', color: SECUNDARIO }}>
          La lectura de abajo se hizo con {plazoTraducido} meses.{' '}
          <button style={{ ...botonTexto, padding: 0, fontSize: '0.88rem' }} onClick={actualizarLectura}>
            Actualizar con {plazo} meses
          </button>
        </p>
      )}

      {!reporte ? (
        <SinReporte />
      ) : (
        <div style={columnas}>
          <Bloque titulo="Cómo leer este trato" destacado>
            <p style={parrafo}>{reporte.lectura ?? 'Sin lectura.'}</p>
            {reporte.recomendacion && <p style={{ ...parrafo, marginTop: '8px', color: TEXTO, fontWeight: 600 }}>{reporte.recomendacion}</p>}
          </Bloque>
          <Bloque titulo="Riesgos">
            <Lista items={reporte.riesgos} />
          </Bloque>
        </div>
      )}
    </div>
  );
}

// ── Texto para copiar y pegar en un correo o chat del área ──

interface ContextoCopia {
  productos: ProductoEnEtapa[];
  numeros: NumerosTrato;
  perfil: Perfil;
  empresa: string | null;
}

const vinetas = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- (nada)');

function comoTextoVentas(t: Traduccion | null, c: ContextoCopia) {
  const r = t?.ventas;
  if (!r) return '';
  return [
    `PARA VENTAS · ${c.empresa ?? 'Cliente'}`,
    `Quién es: ${r.perfil ?? '—'}${c.perfil.nivel ? ` (nivel técnico ${c.perfil.nivel})` : ''}`,
    `Su dolor:\n${vinetas(r.dolor.map((d) => (d.cita ? `${d.texto} — "${d.cita}"` : d.texto)))}`,
    `Qué lo mueve:\n${vinetas(r.motivadores)}`,
    `Cómo hablarle: ${r.comoHablarle ?? '—'}`,
    `Objeciones probables:\n${vinetas(r.objeciones.map((o) => `"${o.objecion}" → ${o.respuesta}`))}`,
    `Quién decide: ${r.decide ?? 'Falta'} · Para cuándo: ${r.cuando ?? 'Falta'}`,
    `Siguiente paso: ${r.siguientePaso ?? '—'}`,
    `Ya se le dijo:\n${vinetas(r.prometido)}`,
  ].join('\n\n');
}

function comoTextoIT(t: Traduccion | null, c: ContextoCopia) {
  const r = t?.it;
  if (!r) return '';
  const productos = c.productos
    .filter((p) => p.estado !== 'sugerido')
    .map((p) => `${p.sku} ${producto(p.sku).nombre} · ${p.cantidad ?? p.nota ?? '—'} · ${p.estado}`);
  return [
    `PARA IT · ${c.empresa ?? 'Cliente'}`,
    `Resumen: ${r.resumen ?? '—'}`,
    `¿Entra arquitecto?: ${r.porQueArquitecto ?? '—'}`,
    `Productos:\n${vinetas(productos)}`,
    `Requisitos:\n${vinetas(r.requisitos.map((q) => `${q.parametro}: ${q.valor ?? '—'} [${q.estado}]${q.fuente ? ` (${q.fuente})` : ''}`))}`,
    `Preguntas pendientes:\n${vinetas(r.preguntasAbiertas)}`,
    `Ya se le dijo al cliente:\n${vinetas(r.prometido)}`,
  ].join('\n\n');
}

function comoTextoFinanzas(t: Traduccion | null, c: ContextoCopia) {
  const n = c.numeros;
  const r = t?.finanzas;
  return [
    `PARA FINANZAS · ${c.empresa ?? 'Cliente'} · plazo ${n.plazoMeses} meses (MXN)`,
    `Ingreso mensual: ${moneda(n.mensual)} sin IVA (${moneda(n.mensualConIva)} con IVA)`,
    `Cargos únicos: ${moneda(n.unico)}`,
    `Valor del contrato: ${moneda(n.valorContrato)}`,
    `Descuento total: ${n.descuentoTotalPct.toFixed(1)}%${n.rebasaTopeVendedor ? ' (requiere autorización del gerente)' : ''}`,
    `Sin precio todavía:\n${vinetas(n.sinPrecio)}`,
    'Margen: falta el costo en el catálogo.',
    r ? `Lectura: ${r.lectura ?? '—'}\nRecomendación: ${r.recomendacion ?? '—'}\nRiesgos:\n${vinetas(r.riesgos)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ── Piezas chicas ──

const columnas: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' };
const columna: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 };
const parrafo: CSSProperties = { margin: 0, fontSize: '0.95rem', color: SECUNDARIO, lineHeight: 1.5 };
const tabla: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginTop: '8px' };
const celda: CSSProperties = { padding: '8px 10px 8px 0', borderBottom: `1px solid ${SEPARADOR}`, verticalAlign: 'top', color: TEXTO };
const celdaTitulo: CSSProperties = { ...celda, color: TERCIARIO, fontWeight: 600, fontSize: '0.8rem', textAlign: 'left' };

function Bloque({ titulo, children, destacado }: { titulo: string; children: ReactNode; destacado?: boolean }) {
  return (
    <div style={destacado ? { backgroundColor: '#f5fbff', borderRadius: '14px', padding: '14px 16px' } : undefined}>
      <h3 style={{ ...tituloTarjeta, fontSize: '1rem', marginBottom: '8px', color: destacado ? AZUL_TEXTO : TEXTO }}>{titulo}</h3>
      {children}
    </div>
  );
}

function Metrica({ titulo, valor, detalle, tenue }: { titulo: string; valor: string; detalle: string; tenue?: boolean }) {
  return (
    <div style={{ backgroundColor: '#f5f5f7', borderRadius: '14px', padding: '14px 16px' }}>
      <div style={{ fontSize: '0.82rem', color: SECUNDARIO }}>{titulo}</div>
      <div
        style={{
          fontSize: tenue ? '1.15rem' : '1.6rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: tenue ? TERCIARIO : TEXTO,
          fontVariantNumeric: 'tabular-nums',
          margin: '4px 0 2px',
        }}
      >
        {valor}
      </div>
      <div style={{ fontSize: '0.78rem', color: TERCIARIO }}>{detalle}</div>
    </div>
  );
}

function Etiquetas({ items, color, fondo }: { items: string[]; color: string; fondo: string }) {
  if (!items.length) return <Vacio />;
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {items.map((i) => (
        <span key={i} style={{ fontSize: '0.88rem', fontWeight: 600, color, backgroundColor: fondo, borderRadius: '9999px', padding: '5px 12px' }}>
          {i}
        </span>
      ))}
    </div>
  );
}

function Lista({ items }: { items: string[] }) {
  if (!items.length) return <Vacio />;
  return (
    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((i) => (
        <li key={i} style={{ fontSize: '0.95rem', color: SECUNDARIO, lineHeight: 1.45 }}>
          {i}
        </li>
      ))}
    </ul>
  );
}

function Par({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <p style={{ ...parrafo, padding: '4px 0' }}>
      {etiqueta}: <b style={{ color: valor ? TEXTO : NARANJA_TEXTO, fontWeight: 600 }}>{valor ?? 'Falta'}</b>
    </p>
  );
}

function Vacio() {
  return <p style={{ ...parrafo, color: TERCIARIO }}>Nada por ahora.</p>;
}

function SinReporte() {
  return <p style={{ ...parrafo, color: TERCIARIO }}>Esta parte no se pudo generar. Usa "Volver a traducir".</p>;
}

function Girando({ tamano }: { tamano: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: `${tamano}px`,
        height: `${tamano}px`,
        flexShrink: 0,
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: `${Math.max(2, Math.round(tamano / 9))}px solid ${SEPARADOR}`,
        borderTopColor: AZUL,
        animation: 'girar 0.8s linear infinite',
      }}
    />
  );
}
