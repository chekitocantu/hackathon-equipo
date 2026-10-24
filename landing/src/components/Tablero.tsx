// El tablero del vendedor: mapa de soluciones, siguiente pregunta, lo que falta saber y la cotización.
// Lo comparten el simulador (datos de un guion) y "Enlaza tu llamada" (datos que saca Claude en vivo).
import { useState, type ReactNode } from 'react';
import MapaSoluciones, { COLORES } from './MapaSoluciones';
import type { Pregunta } from '../lib/casos';
import { CONDICIONES, FAMILIAS, producto, regla } from '../lib/catalogo';
import { carrilDe, cotizar, type Carril, type LineaCotizada, type ProductoEnEtapa } from '../lib/cotizador';
import { conTipoDeCaso, evaluar, preguntaDelAgente, preguntasDelCliente, type Ayuda, type ProductoCatalogo } from '../lib/ayuda';
import {
  AZUL,
  AZUL_BOTON,
  AZUL_TEXTO,
  botonPrimario,
  botonTexto,
  fila,
  moneda,
  MORADO,
  MORADO_TEXTO,
  NARANJA,
  NARANJA_TEXTO,
  SECUNDARIO,
  SEPARADOR,
  tarjeta,
  TERCIARIO,
  TEXTO,
  tituloTarjeta,
  VERDE,
  VERDE_TEXTO,
} from './tema';

const CARRILES: Record<Carril, { color: string; texto: string; explicacion: string }> = {
  estándar: { color: VERDE, texto: 'Estándar', explicacion: 'El vendedor lo cotiza solo' },
  mixto: { color: MORADO, texto: 'Mixto', explicacion: 'Una parte hoy, otra con arquitecto' },
  'a la medida': { color: MORADO, texto: 'A la medida', explicacion: 'Lo diseña un arquitecto' },
};

export interface DatoTablero {
  etiqueta: string;
  valor: string | null;
}

interface TableroProps {
  /** Lo último que dijo el cliente. */
  mensaje: { rotulo: string; texto: string | null; vacio: string };
  productos: ProductoEnEtapa[];
  datos: DatoTablero[];
  reglas: string[];
  pregunta: Pregunta | null;
  apilado: boolean;
  /** En el simulador avanza a la siguiente etapa; en vivo no hace falta. */
  alHacerPregunta?: () => void;
  /** Texto mientras todavía no hay nada que preguntar ni cotizar. */
  esperando?: string;
  /** Lo dicho hasta ahora; de aquí salen las preguntas del cliente para el algoritmo de ayuda de IT. */
  conversacion: { quien: string; texto: string }[];
  /** Preguntas que el agente ya le sugirió al vendedor en turnos anteriores (la actual va en `pregunta`). */
  preguntasSugeridas?: string[];
  /** Si el servidor ya evaluó la llamada completa (con lo guardado en InsForge), se usa esa en vez de la local. */
  ayuda?: Ayuda | null;
}

const CATALOGO_IT = {
  get: (sku: string): ProductoCatalogo | undefined => {
    try {
      return producto(sku);
    } catch {
      return undefined;
    }
  },
};

export default function Tablero({
  mensaje,
  productos,
  datos,
  reglas,
  pregunta,
  apilado,
  alHacerPregunta,
  esperando,
  conversacion,
  preguntasSugeridas = [],
  ayuda: ayudaServidor,
}: TableroProps) {
  const [plazo, setPlazo] = useState(12);

  const cotizacion = cotizar(productos, plazo);
  const carril = carrilDe(cotizacion, reglas);

  // El algoritmo corre en cada cambio aquí mismo; así se evalúa aunque el agente o InsForge no respondan.
  // El tipo de caso es el mismo que el de la cotización, para no mostrar dos respuestas distintas.
  const ayudaBase =
    ayudaServidor ??
    evaluar(
      [...preguntasDelCliente(conversacion), ...[...preguntasSugeridas, pregunta?.texto].flatMap((t) => preguntaDelAgente(t))],
      productos,
      reglas.map((id) => ({ id, texto: regla(id) })),
      CATALOGO_IT,
    );
  const ayuda = conTipoDeCaso(ayudaBase, productos.some((p) => p.estado !== 'sugerido') ? carril : 'por definir');
  const datosListos = datos.filter((d) => d.valor).length;
  const siguienteFaltante = pregunta ? datos.findIndex((d) => !d.valor) : -1;
  const listo = pregunta === null && productos.length > 0;
  const conArquitecto = cotizacion.lineas.filter((l) => l.sinPrecio === 'arquitecto').map((l) => l.producto.nombre);
  const familiasConSenal = new Set(productos.map((p) => producto(p.sku).familia));
  const familiasSinSenal = FAMILIAS.filter((f) => !familiasConSenal.has(f.id)).map((f) => f.nombre);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: apilado ? '1fr' : 'minmax(0, 1fr) clamp(330px, 26vw, 390px)',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
        {/* Lo que acaba de decir el cliente */}
        <div style={{ padding: '0 4px' }}>
          <p style={{ margin: '0 0 3px', fontSize: '0.82rem', color: TERCIARIO }}>{mensaje.rotulo}</p>
          <p
            style={{
              margin: 0,
              fontSize: 'clamp(1.05rem, 2.2vh, 1.3rem)',
              fontWeight: 600,
              lineHeight: 1.35,
              letterSpacing: '-0.012em',
              color: mensaje.texto ? TEXTO : TERCIARIO,
              // En vivo el cliente puede hablar mucho: se muestran las últimas líneas y no se empuja el tablero.
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {mensaje.texto ? `“${mensaje.texto}”` : mensaje.vacio}
          </p>
        </div>

        {/* Mapa de soluciones: toma todo el alto que sobra. El mínimo es de la tarjeta (no del dibujo) para que el
            dibujo nunca se salga y se encime en las tarjetas de abajo; en pantallas bajas la página hace scroll. */}
        <section style={{ ...tarjeta, flex: 1, minHeight: apilado ? 0 : '230px', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <h2 style={tituloTarjeta}>Mapa de soluciones</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.8rem', color: SECUNDARIO }}>
              <Leyenda color={AZUL} texto="Incluido" />
              <Leyenda color={NARANJA} texto="Falta un dato" />
              <Leyenda color={MORADO} texto="Arquitecto" />
              <Leyenda color="#c7c7cc" texto="Sugerido" />
            </div>
          </div>
          <div style={{ position: 'relative', ...(apilado ? { aspectRatio: '1080 / 250' } : { flex: 1, minHeight: 0 }) }}>
            <MapaSoluciones productos={productos} />
          </div>
          {familiasSinSenal.length > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: TERCIARIO }}>Sin señal: {familiasSinSenal.join(' · ')}</p>
          )}
        </section>

        {/* Pregunta sugerida + lo que falta saber */}
        <div style={{ display: 'grid', gridTemplateColumns: apilado ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: '12px' }}>
          <section style={{ ...tarjeta, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {pregunta ? (
              <>
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: AZUL_TEXTO }}>Pregúntale ahora</p>
                <p style={{ margin: '6px 0', fontSize: 'clamp(1.1rem, 2.4vh, 1.4rem)', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                  {pregunta.texto}
                </p>
                {pregunta.motivo && <p style={{ margin: 0, fontSize: '0.9rem', color: SECUNDARIO }}>{pregunta.motivo.replace(/\.?$/, '.')}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {alHacerPregunta && (
                    <button style={botonPrimario} onClick={alHacerPregunta}>
                      Ya la hice
                    </button>
                  )}
                  <span style={{ fontSize: '0.78rem', color: TERCIARIO, marginLeft: 'auto' }}>{pregunta.fuente}</span>
                </div>
              </>
            ) : listo ? (
              <Resultado carril={carril} conArquitecto={conArquitecto} />
            ) : (
              <>
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: AZUL_TEXTO }}>Escuchando</p>
                <p style={{ margin: '6px 0 0', fontSize: '1.05rem', color: SECUNDARIO, lineHeight: 1.4 }}>
                  {esperando ?? 'La primera pregunta aparece cuando el cliente cuente su problema.'}
                </p>
              </>
            )}
          </section>

          <section style={tarjeta}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2px' }}>
              <h3 style={{ ...tituloTarjeta, fontSize: '1rem' }}>Lo que falta saber</h3>
              <span style={{ fontSize: '0.85rem', color: SECUNDARIO, fontVariantNumeric: 'tabular-nums' }}>
                {datosListos} de {datos.length}
              </span>
            </div>
            {datos.length === 0 && <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: TERCIARIO }}>Aparece en cuanto se detecte el caso.</p>}
            {datos.map((d, i) => {
              const esSiguiente = i === siguienteFaltante;
              return (
                <div
                  key={d.etiqueta}
                  style={{
                    ...fila,
                    alignItems: 'flex-start',
                    padding: 'clamp(5px, 0.9vh, 9px) 0',
                    fontSize: '0.88rem',
                    borderBottom: i === datos.length - 1 ? 'none' : fila.borderBottom,
                  }}
                >
                  <Marca lista={!!d.valor} siguiente={esSiguiente} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: d.valor ? TEXTO : esSiguiente ? NARANJA_TEXTO : TERCIARIO }}>{d.etiqueta}</div>
                    {d.valor && <div style={{ color: SECUNDARIO, marginTop: '1px' }}>{d.valor}</div>}
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        {/* Algoritmo de ayuda de IT: si hace falta un especialista y para qué */}
        <ApoyoIT ayuda={ayuda} apilado={apilado} />
      </div>

      {/* ── Barra lateral: cotización siempre a la vista ── */}
      <aside style={{ ...tarjeta, padding: '22px 24px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <h2 style={tituloTarjeta}>Cotización</h2>
          {productos.length > 0 && (
            <span
              title={CARRILES[carril].explicacion}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: TEXTO,
                backgroundColor: '#f2f2f7',
                borderRadius: '9999px',
                padding: '4px 10px',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: CARRILES[carril].color }} />
              {CARRILES[carril].texto}
            </span>
          )}
        </div>
        {productos.length > 0 && (
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: SECUNDARIO, lineHeight: 1.4 }}>
            {reglas.length === 0
              ? CARRILES[carril].explicacion
              : reglas.map((id) => (
                  <span key={id} style={{ display: 'block' }}>
                    <b style={{ color: MORADO_TEXTO, fontWeight: 600 }}>{id}</b> · {regla(id)}
                  </span>
                ))}
          </p>
        )}

        <div style={{ margin: '14px 0 4px' }}>
          {cotizacion.hayPrecio ? (
            <>
              <span style={{ fontSize: 'clamp(2.2rem, 4.6vh, 3rem)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {moneda(cotizacion.mensual)}
              </span>
              <div style={{ color: SECUNDARIO, fontSize: '0.88rem', marginTop: '6px' }}>
                MXN al mes, sin IVA
                {cotizacion.unico > 0 && ` · más ${moneda(cotizacion.unico)} de cargos únicos`}
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Sin precio de lista</span>
              <div style={{ color: SECUNDARIO, fontSize: '0.88rem', marginTop: '4px' }}>
                {carril === 'a la medida' ? 'Lo arma un arquitecto con el resumen de la llamada' : 'Aparece cuando el cliente da los datos'}
              </div>
            </>
          )}
        </div>

        {/* Si algún día no cabe, solo esta lista se desplaza; el total y el botón no se mueven */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
            marginTop: '10px',
            borderTop: `1px solid ${SEPARADOR}`,
          }}
        >
          {cotizacion.lineas.map((l) => (
            <LineaProducto key={l.producto.sku} linea={l} />
          ))}
          {cotizacion.paquete && (
            <Descuento
              texto={`Paquete «${cotizacion.paquete.paquete.nombre}» · ${cotizacion.paquete.paquete.descuento_pct}%`}
              monto={cotizacion.paquete.monto}
            />
          )}
          {cotizacion.plazo.monto > 0 && <Descuento texto={`Plazo de ${plazo} meses · ${cotizacion.plazo.pct}%`} monto={cotizacion.plazo.monto} />}
        </div>

        {cotizacion.hayPrecio && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: SECUNDARIO }}>Plazo</span>
              <div style={{ flex: 1 }}>
                <Segmentado
                  etiqueta="Plazo del contrato"
                  compacto
                  elegido={[12, 24, 36].indexOf(plazo)}
                  alElegir={(i) => setPlazo([12, 24, 36][i])}
                  opciones={[12, 24, 36].map((m) => ({ id: String(m), titulo: `${m} meses` }))}
                />
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: TERCIARIO, lineHeight: 1.45 }}>
              Con IVA ({CONDICIONES.ivaPct}%): {moneda(cotizacion.mensualConIva)} al mes · Vigencia de {CONDICIONES.vigenciaDias} días
              {cotizacion.rebasaTopeVendedor && (
                <span style={{ display: 'block', color: NARANJA_TEXTO }}>
                  Descuento total de {Math.round(cotizacion.descuentoTotalPct)}%: arriba de {CONDICIONES.topeVendedorPct}% pide autorización del gerente.
                </span>
              )}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          {carril !== 'a la medida' && (
            <button
              style={{
                ...botonPrimario,
                flex: carril === 'mixto' ? '1 1 100%' : 1,
                whiteSpace: 'nowrap',
                padding: '12px 18px',
                ...(!listo && { backgroundColor: '#e8e8ed', color: TERCIARIO, cursor: 'default' }),
              }}
            >
              {listo ? 'Enviar propuesta' : 'Enviar al terminar'}
            </button>
          )}
          {carril !== 'estándar' && (
            <button
              style={
                carril === 'a la medida'
                  ? { ...botonPrimario, flex: 1, padding: '12px 18px', backgroundColor: listo ? MORADO_TEXTO : '#e8e8ed', color: listo ? '#ffffff' : TERCIARIO }
                  : { ...botonTexto, color: MORADO_TEXTO, margin: '0 auto', padding: '4px 6px' }
              }
            >
              {carril === 'a la medida' ? 'Enviar resumen al arquitecto' : 'Resumen al arquitecto'}
            </button>
          )}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: TERCIARIO, textAlign: 'center' }}>Precios del catálogo simulado del hackathon</p>
      </aside>
    </div>
  );
}

const NIVELES_IT: Record<Ayuda['nivel'], { color: string; texto: string; titulo: string }> = {
  no: { color: VERDE, texto: VERDE_TEXTO, titulo: 'No: lo resuelves tú' },
  consulta: { color: NARANJA, texto: NARANJA_TEXTO, titulo: 'Sí, para una parte' },
  acompaña: { color: MORADO, texto: MORADO_TEXTO, titulo: 'Sí: pide un especialista de IT' },
};

/** "¿Necesitas a alguien especializado de IT?": la respuesta, el conteo de preguntas técnicas y qué sí y qué no le toca a IT. */
function ApoyoIT({ ayuda, apilado }: { ayuda: Ayuda; apilado: boolean }) {
  const nivel =
    ayuda.nivel === 'no' && ayuda.tipoCaso === 'por definir' ? { color: SEPARADOR, texto: TERCIARIO, titulo: 'Aún no se sabe' } : NIVELES_IT[ayuda.nivel];
  const proporcion = ayuda.total ? ayuda.tecnicas / ayuda.total : 0;
  const lista = (puntos: Ayuda['entra'], vacio: string) =>
    puntos.length ? (
      puntos.slice(0, 3).map((p) => (
        <div key={p.tema + p.fuente} style={{ fontSize: '0.84rem', lineHeight: 1.35, marginTop: '4px' }}>
          <span style={{ color: TEXTO, fontWeight: 600 }}>{p.tema}</span> <span style={{ color: SECUNDARIO }}>· {p.motivo}</span>
        </div>
      ))
    ) : (
      <div style={{ fontSize: '0.84rem', color: TERCIARIO, marginTop: '4px' }}>{vacio}</div>
    );

  return (
    <section style={{ ...tarjeta, padding: '14px 20px', boxShadow: `inset 4px 0 0 ${nivel.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ ...tituloTarjeta, fontSize: '1rem' }}>¿Necesitas a alguien especializado de IT?</h3>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: nivel.texto }}>{nivel.titulo}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: SECUNDARIO }}>
          <span style={{ width: '80px', height: '6px', borderRadius: '3px', backgroundColor: SEPARADOR, overflow: 'hidden' }}>
            <span
              style={{
                display: 'block',
                width: `${Math.round(proporcion * 100)}%`,
                height: '100%',
                backgroundColor: proporcion >= ayuda.umbral ? MORADO : AZUL_BOTON,
              }}
            />
          </span>
          {ayuda.tecnicas} de {ayuda.total} preguntas técnicas · se pide IT desde {Math.round(ayuda.umbral * 10)} de 10
        </span>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: SECUNDARIO }}>
        Caso <b style={{ color: TEXTO }}>{ayuda.tipoCaso}</b> · {ayuda.aviso}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: apilado ? '1fr' : '1fr 1fr', gap: '16px', marginTop: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: MORADO_TEXTO, letterSpacing: '0.03em' }}>SÍ ENTRA EL ESPECIALISTA</div>
          {lista(ayuda.entra, 'Nada por ahora.')}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: VERDE_TEXTO, letterSpacing: '0.03em' }}>NO HACE FALTA</div>
          {lista(ayuda.noEntra, 'Aparece cuando se detecte un producto estándar.')}
        </div>
      </div>
    </section>
  );
}

function Resultado({ carril, conArquitecto }: { carril: Carril; conArquitecto: string[] }) {
  const contenido = {
    estándar: {
      color: VERDE_TEXTO,
      rotulo: 'Cotización completa',
      titulo: 'Ya puedes enviar la propuesta en esta llamada.',
      nota: 'No hace falta otra sesión con ingeniería.',
    },
    mixto: {
      color: MORADO_TEXTO,
      rotulo: 'Propuesta parcial lista',
      titulo: 'Envía hoy la parte estándar; lo demás va al arquitecto con resumen.',
      nota: `El arquitecto solo entra para: ${conArquitecto.join(', ')}.`,
    },
    'a la medida': {
      color: MORADO_TEXTO,
      rotulo: 'Resumen listo para el arquitecto',
      titulo: 'El arquitecto entra con todo lo que ya contó el cliente.',
      nota: 'El cliente no tendrá que repetirlo en la siguiente reunión.',
    },
  }[carril];

  return (
    <>
      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: contenido.color }}>{contenido.rotulo}</p>
      <p style={{ margin: '6px 0', fontSize: 'clamp(1.1rem, 2.4vh, 1.4rem)', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
        {contenido.titulo}
      </p>
      <p style={{ margin: 0, fontSize: '0.9rem', color: SECUNDARIO }}>{contenido.nota}</p>
    </>
  );
}

function LineaProducto({ linea }: { linea: LineaCotizada }) {
  const derecha: Record<string, ReactNode> = {
    'falta-dato': <span style={{ color: NARANJA_TEXTO }}>Falta un dato</span>,
    arquitecto: <span style={{ color: MORADO_TEXTO, fontWeight: 600 }}>Arquitecto</span>,
    consumo: <span style={{ color: SECUNDARIO }}>Según consumo</span>,
  };
  const monto = linea.mensual > 0 ? moneda(linea.mensual) : `${moneda(linea.unico)} único`;
  const color = linea.sinPrecio === 'arquitecto' ? COLORES.arquitecto.texto : TEXTO;

  return (
    <div style={{ ...fila, alignItems: 'flex-start', padding: 'clamp(5px, 0.9vh, 9px) 0', fontSize: '0.9rem' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color }}>{linea.producto.nombre}</div>
        <div style={{ fontSize: '0.78rem', color: TERCIARIO, marginTop: '1px' }}>{linea.detalle}</div>
      </div>
      <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {linea.sinPrecio ? derecha[linea.sinPrecio] : monto}
      </span>
    </div>
  );
}

function Descuento({ texto, monto }: { texto: string; monto: number }) {
  return (
    <div style={{ ...fila, padding: 'clamp(5px, 0.9vh, 9px) 0', fontSize: '0.88rem', color: VERDE_TEXTO }}>
      <span>{texto}</span>
      <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>−{moneda(monto)}</span>
    </div>
  );
}

export function Segmentado({
  opciones,
  elegido,
  alElegir,
  etiqueta,
  compacto,
}: {
  opciones: { id: string; titulo: string; sub?: string }[];
  elegido: number;
  alElegir: (i: number) => void;
  etiqueta: string;
  compacto?: boolean;
}) {
  const borde = compacto ? 3 : 4;
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `repeat(${opciones.length}, 1fr)`,
        backgroundColor: '#e8e8ed',
        borderRadius: compacto ? '10px' : '14px',
        padding: `${borde}px`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: `${borde}px`,
          bottom: `${borde}px`,
          left: `calc(${borde}px + (100% - ${borde * 2}px) * ${elegido / opciones.length})`,
          width: `calc((100% - ${borde * 2}px) / ${opciones.length})`,
          backgroundColor: '#ffffff',
          borderRadius: compacto ? '8px' : '10px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 1px rgba(0, 0, 0, 0.04)',
          transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      {opciones.map((o, i) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={i === elegido}
          onClick={() => alElegir(i)}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            padding: compacto ? '5px 4px' : '7px 6px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1px',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: compacto ? '0.82rem' : '0.92rem', fontWeight: 600, color: i === elegido ? TEXTO : SECUNDARIO, whiteSpace: 'nowrap' }}>
            {o.titulo}
          </span>
          {o.sub && (
            <span
              style={{
                fontSize: '0.72rem',
                color: TERCIARIO,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {o.sub}
            </span>
          )}
        </button>
      ))}
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
        marginTop: '1px',
        borderRadius: '50%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: lista ? VERDE : 'transparent',
        border: lista ? 'none' : `1.5px solid ${siguiente ? NARANJA : '#c7c7cc'}`,
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
