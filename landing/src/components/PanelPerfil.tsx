// Fase 1 de la llamada: el perfil del cliente. Muestra las 10 preguntas agrupadas, lo que el cliente ya contestó
// y un diagnóstico; cuando el vendedor lo decide, se pasa al tablero de cotización.
import type { ReactNode } from 'react';
import { BLOQUES, PREGUNTAS_PERFIL, respondidas, type NivelTecnico, type Perfil } from '../lib/perfil';
import { familia, regla } from '../lib/catalogo';
import {
  AZUL,
  AZUL_TEXTO,
  botonPrimario,
  botonTexto,
  fila,
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
} from './tema';

const NIVELES: Record<NivelTecnico, { color: string; texto: string; consejo: string }> = {
  básico: { color: VERDE, texto: 'Básico', consejo: 'Habla en términos de negocio, sin siglas.' },
  intermedio: { color: NARANJA, texto: 'Intermedio', consejo: 'Puedes nombrar sistemas, sin entrar a detalle técnico.' },
  avanzado: { color: AZUL, texto: 'Avanzado', consejo: 'Tienen área de TI: se puede hablar técnico.' },
};

interface PanelPerfilProps {
  perfil: Perfil;
  mensaje: { rotulo: string; texto: string | null; vacio: string };
  apilado: boolean;
  alAnalizar: () => void;
  alSaltar: () => void;
}

export default function PanelPerfil({ perfil, mensaje, apilado, alAnalizar, alSaltar }: PanelPerfilProps) {
  const total = PREGUNTAS_PERFIL.length;
  const listas = respondidas(perfil);
  const bloques = (Object.keys(BLOQUES) as (keyof typeof BLOQUES)[]).map((b) => ({
    id: b,
    titulo: BLOQUES[b],
    preguntas: PREGUNTAS_PERFIL.filter((p) => p.bloque === b),
  }));

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
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {mensaje.texto ? `“${mensaje.texto}”` : mensaje.vacio}
          </p>
        </div>

        {/* Las 10 preguntas en 4 bloques; la siguiente que conviene hacer va resaltada */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: apilado ? '1fr' : '1fr 1fr',
            gridAutoRows: apilado ? 'auto' : '1fr',
            gap: '12px',
          }}
        >
          {bloques.map((b) => (
            <section key={b.id} style={{ ...tarjeta, padding: '16px 20px', minHeight: 0, overflow: 'auto' }}>
              <h3 style={{ ...tituloTarjeta, fontSize: '1rem', marginBottom: '4px' }}>
                <span style={{ color: TERCIARIO, marginRight: '6px' }}>{b.id}</span>
                {b.titulo}
              </h3>
              {b.preguntas.map((p, i) => {
                const respuesta = perfil.respuestas[p.id];
                const esSiguiente = p.id === perfil.siguiente;
                return (
                  <div
                    key={p.id}
                    style={{
                      ...fila,
                      alignItems: 'flex-start',
                      padding: 'clamp(5px, 0.8vh, 8px) 0',
                      borderBottom: i === b.preguntas.length - 1 ? 'none' : `1px solid ${SEPARADOR}`,
                    }}
                  >
                    <Marca lista={!!respuesta} siguiente={esSiguiente} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: esSiguiente ? 700 : 500, color: respuesta ? TEXTO : esSiguiente ? NARANJA_TEXTO : SECUNDARIO }}>
                        {p.texto}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: respuesta ? SECUNDARIO : TERCIARIO, marginTop: '1px' }}>
                        {respuesta ?? p.revela}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>

      {/* Barra lateral: diagnóstico del cliente y paso a la cotización */}
      <aside style={{ ...tarjeta, padding: '22px 24px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: AZUL_TEXTO }}>Fase 1 de 2</p>
        <h2 style={{ ...tituloTarjeta, marginTop: '2px' }}>Perfil del cliente</h2>

        <div style={{ margin: '12px 0 4px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: 'clamp(2rem, 4.2vh, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
            {listas} de {total}
          </span>
          <span style={{ color: SECUNDARIO, fontSize: '0.9rem' }}>preguntas</span>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', backgroundColor: SEPARADOR }}>
          <div style={{ width: `${(listas / total) * 100}%`, height: '100%', borderRadius: '2px', backgroundColor: AZUL, transition: 'width 0.5s ease' }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Dato titulo="Nivel técnico">
            {perfil.nivel ? (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: TEXTO }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: NIVELES[perfil.nivel].color }} />
                  {NIVELES[perfil.nivel].texto}
                </span>
                <span style={{ display: 'block', marginTop: '2px' }}>{NIVELES[perfil.nivel].consejo}</span>
              </>
            ) : (
              'Sale de quién ve la tecnología y qué sistemas usan.'
            )}
          </Dato>

          <Dato titulo="Diagnóstico">{perfil.resumen ?? 'Aparece cuando el cliente cuente qué pasó y cómo lo resuelve hoy.'}</Dato>

          {perfil.familias.length > 0 && (
            <Dato titulo="Probablemente aplica">
              <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                {perfil.familias.map((id) => (
                  <span key={id} style={{ fontSize: '0.8rem', fontWeight: 600, color: AZUL_TEXTO, backgroundColor: '#eaf7ff', borderRadius: '9999px', padding: '3px 10px' }}>
                    {familia(id).nombre}
                  </span>
                ))}
              </span>
            </Dato>
          )}

          {perfil.reglas.length > 0 && (
            <Dato titulo="Ojo desde ahora">
              {perfil.reglas.map((id) => (
                <span key={id} style={{ display: 'block' }}>
                  <b style={{ color: MORADO_TEXTO, fontWeight: 600 }}>{id}</b> · {regla(id)}
                </span>
              ))}
            </Dato>
          )}
        </div>

        <button style={{ ...botonPrimario, width: '100%', padding: '13px 18px', marginTop: '14px' }} onClick={alAnalizar}>
          Analizar perfil y empezar a cotizar
        </button>
        <button style={{ ...botonTexto, marginTop: '4px', color: SECUNDARIO }} onClick={alSaltar}>
          Saltar perfil
        </button>
      </aside>
    </div>
  );
}

/** Resumen del perfil en una línea, arriba del tablero de cotización. */
export function TiraPerfil({ perfil }: { perfil: Perfil }) {
  if (!respondidas(perfil) && !perfil.resumen) return null;
  return (
    <div
      style={{
        ...tarjeta,
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.88rem',
        color: SECUNDARIO,
        minWidth: 0,
      }}
    >
      <span style={{ fontWeight: 700, color: TEXTO, whiteSpace: 'nowrap' }}>Perfil</span>
      {perfil.nivel && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', color: TEXTO, fontWeight: 600 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: NIVELES[perfil.nivel].color }} />
          {NIVELES[perfil.nivel].texto}
        </span>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {perfil.resumen ?? `${respondidas(perfil)} de ${PREGUNTAS_PERFIL.length} preguntas de perfil contestadas`}
      </span>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: TERCIARIO, marginBottom: '3px' }}>{titulo}</div>
      <div style={{ fontSize: '0.9rem', color: SECUNDARIO, lineHeight: 1.45 }}>{children}</div>
    </div>
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
