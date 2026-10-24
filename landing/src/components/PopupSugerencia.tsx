// Panel flotante con la lista de preguntas sugeridas al vendedor (fijar, marcar hecha, minimizar).
import type { CSSProperties } from 'react';
import {
  AZUL,
  AZUL_TEXTO,
  SECUNDARIO,
  SEPARADOR,
  TERCIARIO,
  TEXTO,
  VERDE_TEXTO,
  botonPrimario,
  botonTexto,
  tarjeta,
} from './tema';

export interface ItemSugerencia {
  id: string;
  texto: string;       // the question
  motivo: string;
  fuente: string;
  oportunidad: string; // why it appeared, e.g. 'Hubo una pausa en la plática'
  hora: string;        // e.g. '02:15' (call clock)
  hecha: boolean;      // the seller already asked it
  actual: boolean;     // it is what the agent suggests right now
}

export interface PanelSugerenciasProps {
  visible: boolean;            // false -> return null
  items: ItemSugerencia[];     // newest first, at most 10
  fijadaId: string | null;     // id of the pinned item, or null
  apilado: boolean;            // narrow screen
  minimizado: boolean;
  alMinimizar: () => void;     // toggles minimizado
  alClicItem: (id: string) => void;     // pins / unpins
  alMarcarHecha: (id: string) => void;
}

const estiloBadge: CSSProperties = {
  borderRadius: '9999px',
  padding: '2px 8px',
  fontSize: '0.7rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const estiloPregunta: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

export default function PanelSugerencias(props: PanelSugerenciasProps) {
  const { visible, items, fijadaId, apilado, minimizado, alMinimizar, alClicItem, alMarcarHecha } = props;
  if (!visible) return null;

  const fijada = items.find((item) => item.id === fijadaId) ?? null;

  const posicion: CSSProperties = apilado
    ? { left: '16px', right: '16px', bottom: '16px', width: 'auto', maxHeight: '60vh' }
    : { right: '24px', bottom: '24px', width: '400px', maxHeight: '72vh' };

  return (
    <>
      <style>{`@keyframes popupSugerenciaEntra { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div
        role="region"
        aria-label="Sugerencias para el vendedor"
        style={{
          ...tarjeta,
          ...posicion,
          position: 'fixed',
          zIndex: 50,
          maxWidth: 'calc(100vw - 32px)',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          borderLeft: `3px solid ${AZUL}`,
          animation: 'popupSugerenciaEntra 220ms ease-out',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${SEPARADOR}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
              color: AZUL_TEXTO,
            }}
          >
            Sugerencias
          </span>
          <span style={{ fontSize: '0.75rem', color: TERCIARIO }}>{items.length} de 10</span>
          <button
            type="button"
            onClick={alMinimizar}
            style={{ ...botonTexto, fontSize: '0.8rem', color: SECUNDARIO, padding: 0, marginLeft: 'auto' }}
          >
            {minimizado ? 'Mostrar' : 'Minimizar'}
          </button>
        </div>

        {!minimizado && (
          <>
            {fijada && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Soltar la pregunta fijada"
                onClick={() => alClicItem(fijada.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && alClicItem(fijada.id)}
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#eaf7ff',
                  borderBottom: `1px solid ${SEPARADOR}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: AZUL_TEXTO, fontWeight: 600 }}>
                  📌 Fijada · toca para soltarla
                </div>
                <p style={{ margin: '6px 0', fontSize: '1.15rem', fontWeight: 700, color: TEXTO, lineHeight: 1.3 }}>
                  {fijada.texto}
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: SECUNDARIO }}>
                  <span style={{ fontWeight: 600 }}>Por qué:</span> {fijada.motivo}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.78rem', color: TERCIARIO }}>{fijada.fuente}</span>
                  {fijada.hecha ? (
                    <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 600, color: VERDE_TEXTO }}>
                      ✓ Hecha
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        alMarcarHecha(fijada.id);
                      }}
                      style={{ ...botonPrimario, padding: '7px 14px', fontSize: '0.85rem', marginLeft: 'auto' }}
                    >
                      Ya la hice
                    </button>
                  )}
                </div>
              </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {items.map((item) => {
                const esFijada = item.id === fijadaId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={esFijada}
                    onClick={() => alClicItem(item.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      backgroundColor: esFijada ? '#f5fbff' : 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${SEPARADOR}`,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          ...estiloPregunta,
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: item.hecha ? TERCIARIO : TEXTO,
                          textDecoration: item.hecha ? 'line-through' : 'none',
                        }}
                      >
                        {item.texto}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: TERCIARIO, marginTop: '2px' }}>
                        {item.hora} · {item.oportunidad}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {item.actual && !item.hecha && (
                        <span style={{ ...estiloBadge, color: AZUL_TEXTO, backgroundColor: '#eaf7ff' }}>Ahora</span>
                      )}
                      {item.hecha && (
                        <span style={{ ...estiloBadge, color: VERDE_TEXTO, backgroundColor: '#eaf8ee' }}>Hecha</span>
                      )}
                      {esFijada && <span style={{ fontSize: '0.8rem' }}>📌</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '8px 16px', fontSize: '0.72rem', color: TERCIARIO }}>
              Toca una pregunta para fijarla; tócala otra vez para soltarla.
            </div>
          </>
        )}
      </div>
    </>
  );
}
