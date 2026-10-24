import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import MapaSoluciones from '../components/MapaSoluciones';
import { DATOS, ETAPAS } from '../lib/simulacion';

// Paleta sobria: grises claros, un solo azul de marca y color solo donde significa algo.
const FONDO = '#f5f5f7';
const TEXTO = '#1d1d1f';
const SECUNDARIO = '#6e6e73';
const TERCIARIO = '#86868b';
const SEPARADOR = '#e5e5ea';
const AZUL = '#00b8ff';
const AZUL_TEXTO = '#0077b6';
const AZUL_BOTON = '#0091d5';
const NARANJA_TEXTO = '#b25000';
const VERDE = '#34c759';
const VERDE_TEXTO = '#248a3d';

const SEGUNDOS_POR_ETAPA = 6;
// Por debajo de este ancho no caben las columnas y se apila todo (ahí sí hay scroll).
const ANCHO_MINIMO_PANTALLA_COMPLETA = 1100;

const tarjeta: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '20px',
  padding: '20px 24px',
  boxSizing: 'border-box',
};

const tituloTarjeta: CSSProperties = {
  margin: 0,
  fontSize: '1.15rem',
  fontWeight: 700,
  letterSpacing: '-0.015em',
  color: TEXTO,
};

const botonPrimario: CSSProperties = {
  backgroundColor: AZUL_BOTON,
  color: '#ffffff',
  border: 'none',
  borderRadius: '9999px',
  padding: '10px 20px',
  fontSize: '0.95rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const botonTexto: CSSProperties = {
  backgroundColor: 'transparent',
  color: AZUL_TEXTO,
  border: 'none',
  padding: '10px 6px',
  fontSize: '0.95rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const fila: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  borderBottom: `1px solid ${SEPARADOR}`,
};

const moneda = (valor: number) => `$${valor.toLocaleString('en-US')}`;

function useAnchoVentana() {
  const [ancho, setAncho] = useState(() => window.innerWidth);
  useEffect(() => {
    const alCambiar = () => setAncho(window.innerWidth);
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  return ancho;
}

export default function SimuladorPage() {
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const apilado = useAnchoVentana() < ANCHO_MINIMO_PANTALLA_COMPLETA;
  const etapa = ETAPAS[indice];
  const ultima = ETAPAS.length - 1;

  useEffect(() => {
    if (!reproduciendo) return;
    if (indice >= ultima) {
      setReproduciendo(false);
      return;
    }
    const t = setTimeout(() => setIndice((i) => i + 1), SEGUNDOS_POR_ETAPA * 1000);
    return () => clearTimeout(t);
  }, [reproduciendo, indice, ultima]);

  const irA = (i: number) => {
    setReproduciendo(false);
    setIndice(Math.max(0, Math.min(ultima, i)));
  };

  const reproducir = () => {
    if (indice >= ultima) setIndice(0);
    setReproduciendo((r) => !r);
  };

  const total = etapa.lineas.reduce((suma, l) => suma + (l.precio ?? 0), 0);
  const estandar = etapa.lineas.filter((l) => l.tipo === 'estandar').length;
  const medida = etapa.lineas.length - estandar;
  const datosListos = DATOS.filter((d) => etapa.datos[d.clave]).length;
  const siguienteFaltante = etapa.pregunta ? DATOS.find((d) => !etapa.datos[d.clave]) : undefined;
  const completa = etapa.precision === 100;

  return (
    <div
      style={{
        height: apilado ? 'auto' : '100vh',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: FONDO,
        color: TEXTO,
        fontFamily: 'var(--font-sans)',
        padding: '16px clamp(16px, 2.2vw, 32px)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* ── Encabezado: quién es el cliente y en qué momento de la llamada vamos ── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: apilado ? 'wrap' : 'nowrap' }}>
        <div style={{ flexShrink: 0 }}>
          <Link to="/" style={{ color: AZUL_TEXTO, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
            ‹ Inicio
          </Link>
          <h1 style={{ margin: '2px 0 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Simulador de llamada
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '0.92rem', color: SECUNDARIO }}>
            Ferreterías del Norte · Retail · {etapa.minuto}
          </p>
        </div>

        <div style={{ flex: 1, minWidth: apilado ? '100%' : 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            role="tablist"
            aria-label="Momentos de la llamada"
            style={{
              position: 'relative',
              flex: 1,
              display: 'grid',
              gridTemplateColumns: `repeat(${ETAPAS.length}, 1fr)`,
              backgroundColor: '#e8e8ed',
              borderRadius: '14px',
              padding: '4px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '4px',
                bottom: '4px',
                left: `calc(4px + (100% - 8px) * ${indice / ETAPAS.length})`,
                width: `calc((100% - 8px) / ${ETAPAS.length})`,
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 1px rgba(0, 0, 0, 0.04)',
                transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
            {ETAPAS.map((e, i) => (
              <button
                key={e.id}
                role="tab"
                aria-selected={i === indice}
                onClick={() => irA(i)}
                style={{
                  position: 'relative',
                  background: 'none',
                  border: 'none',
                  padding: '7px 6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1px',
                }}
              >
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: i === indice ? TEXTO : SECUNDARIO }}>{e.nombre}</span>
                <span style={{ fontSize: '0.72rem', color: TERCIARIO, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {e.minuto} · {e.resumen}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={reproducir}
            aria-label={reproduciendo ? 'Pausar' : 'Reproducir la llamada'}
            style={{
              width: '46px',
              height: '46px',
              flexShrink: 0,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: TEXTO,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              {reproduciendo ? (
                <path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z" fill="#ffffff" />
              ) : (
                <path d="M4 2.2v11.6a.6.6 0 0 0 .9.5l9.4-5.8a.6.6 0 0 0 0-1L4.9 1.7a.6.6 0 0 0-.9.5z" fill="#ffffff" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* ── Cuerpo: llamada a la izquierda, cotización fija a la derecha ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: apilado ? '1fr' : 'minmax(0, 1fr) clamp(320px, 25vw, 380px)',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
          {/* Lo que acaba de decir el cliente */}
          <div style={{ padding: '0 4px' }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.82rem', color: TERCIARIO }}>
              {etapa.cliente ? `Cliente · ${etapa.minuto}` : 'Llamada conectada'}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'clamp(1.05rem, 2.3vh, 1.35rem)',
                fontWeight: 600,
                lineHeight: 1.35,
                letterSpacing: '-0.012em',
                color: etapa.cliente ? TEXTO : TERCIARIO,
              }}
            >
              {etapa.cliente ? `“${etapa.cliente}”` : 'Escuchando al cliente…'}
            </p>
          </div>

          {/* Mapa de soluciones: toma todo el alto que sobra */}
          <section style={{ ...tarjeta, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <h2 style={tituloTarjeta}>Mapa de soluciones</h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.8rem', color: SECUNDARIO }}>
                <Leyenda color={AZUL} texto="Detectado" />
                <Leyenda color="#ff9f0a" texto="Falta un dato" />
                <Leyenda color="#d2d2d7" texto="Sin señal" />
              </div>
            </div>
            <div style={{ position: 'relative', ...(apilado ? { aspectRatio: '1080 / 290' } : { flex: 1, minHeight: '160px' }) }}>
              <MapaSoluciones etapa={etapa} />
            </div>
          </section>

          {/* Pregunta sugerida + datos que faltan */}
          <div style={{ display: 'grid', gridTemplateColumns: apilado ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: '14px' }}>
            <section style={{ ...tarjeta, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {etapa.pregunta ? (
                <>
                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: AZUL_TEXTO }}>Pregúntale ahora</p>
                  <p
                    style={{
                      margin: '6px 0 6px',
                      fontSize: 'clamp(1.1rem, 2.4vh, 1.4rem)',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {etapa.pregunta.texto}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: SECUNDARIO }}>{etapa.pregunta.motivo}.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                    <button style={botonPrimario} onClick={() => irA(indice + 1)}>
                      Ya la hice
                    </button>
                    <button style={botonTexto}>Saltar</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: VERDE_TEXTO }}>Cotización completa</p>
                  <p style={{ margin: '6px 0 6px', fontSize: 'clamp(1.1rem, 2.4vh, 1.4rem)', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                    Ya tienes todo para cerrar en esta llamada.
                  </p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: SECUNDARIO }}>No hace falta otra sesión con ingeniería.</p>
                </>
              )}
            </section>

            <section style={tarjeta}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2px' }}>
                <h3 style={{ ...tituloTarjeta, fontSize: '1rem' }}>Datos para cotizar</h3>
                <span style={{ fontSize: '0.85rem', color: SECUNDARIO, fontVariantNumeric: 'tabular-nums' }}>
                  {datosListos} de {DATOS.length}
                </span>
              </div>
              {DATOS.map((d, i) => {
                const valor = etapa.datos[d.clave];
                const esSiguiente = d === siguienteFaltante;
                return (
                  <div
                    key={d.clave}
                    style={{
                      ...fila,
                      padding: 'clamp(3px, 0.65vh, 7px) 0',
                      fontSize: '0.88rem',
                      borderBottom: i === DATOS.length - 1 ? 'none' : fila.borderBottom,
                    }}
                  >
                    <Marca lista={!!valor} siguiente={esSiguiente} />
                    <span style={{ color: valor ? TEXTO : esSiguiente ? NARANJA_TEXTO : TERCIARIO, whiteSpace: 'nowrap' }}>{d.etiqueta}</span>
                    <span style={{ marginLeft: 'auto', color: SECUNDARIO, textAlign: 'right' }}>{valor ?? ''}</span>
                  </div>
                );
              })}
            </section>
          </div>
        </div>

        {/* ── Barra lateral: cotización siempre a la vista ── */}
        <aside style={{ ...tarjeta, padding: '24px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={tituloTarjeta}>Cotización</h2>
            <span style={{ fontSize: '0.85rem', color: completa ? VERDE_TEXTO : SECUNDARIO, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {etapa.precision}% lista
            </span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', backgroundColor: SEPARADOR, margin: '10px 0 18px' }}>
            <div
              style={{
                width: `${etapa.precision}%`,
                height: '100%',
                borderRadius: '2px',
                backgroundColor: completa ? VERDE : AZUL,
                transition: 'width 0.6s ease, background-color 0.6s ease',
              }}
            />
          </div>

          <span style={{ fontSize: 'clamp(2.4rem, 5vh, 3.2rem)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {moneda(total)}
          </span>
          <span style={{ color: SECUNDARIO, fontSize: '0.92rem', margin: '6px 0 16px' }}>USD al mes</span>

          {/* Si algún día no cabe, solo esta lista se desplaza; el total y el botón no se mueven */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${SEPARADOR}` }}>
            {etapa.lineas.length === 0 && (
              <p style={{ color: TERCIARIO, fontSize: '0.92rem', margin: '14px 0 0', lineHeight: 1.5 }}>
                Los productos aparecen aquí conforme el cliente habla.
              </p>
            )}
            {etapa.lineas.map((l) => (
              <div key={l.concepto} style={{ ...fila, alignItems: 'flex-start', padding: '10px 0', fontSize: '0.9rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div>{l.concepto}</div>
                  {l.tipo === 'medida' && <div style={{ fontSize: '0.78rem', color: NARANJA_TEXTO, marginTop: '2px' }}>A la medida</div>}
                </div>
                <span
                  style={{
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: l.precio === null ? 400 : 600,
                    color: l.precio === null ? NARANJA_TEXTO : TEXTO,
                  }}
                >
                  {l.precio === null ? 'Falta un dato' : moneda(l.precio)}
                </span>
              </div>
            ))}
          </div>

          <p style={{ margin: '14px 0 16px', fontSize: '0.84rem', color: SECUNDARIO, lineHeight: 1.5 }}>
            {estandar} estándar · {medida} a la medida · {etapa.arquitecto ? 'requiere arquitecto' : 'sin arquitecto'}
            <br />
            <span style={{ color: TERCIARIO }}>Precios de ejemplo</span>
          </p>

          <button
            style={{
              ...botonPrimario,
              width: '100%',
              padding: '13px 20px',
              ...(!completa && { backgroundColor: '#e8e8ed', color: TERCIARIO, cursor: 'default' }),
            }}
          >
            {completa ? 'Enviar propuesta' : 'Enviar propuesta al llegar a 100%'}
          </button>
        </aside>
      </div>
    </div>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
      {texto}
    </span>
  );
}

function Marca({ lista, siguiente }: { lista: boolean; siguiente: boolean }) {
  return (
    <span
      style={{
        width: '18px',
        height: '18px',
        flexShrink: 0,
        borderRadius: '50%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: lista ? VERDE : 'transparent',
        border: lista ? 'none' : `1.5px solid ${siguiente ? '#ff9f0a' : '#c7c7cc'}`,
      }}
    >
      {lista && (
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 5.2l2 2L8 3" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
