// Popup flotante que sugiere al vendedor la siguiente pregunta a hacer.
import type { CSSProperties } from 'react';
import {
  AZUL,
  AZUL_TEXTO,
  SECUNDARIO,
  TERCIARIO,
  TEXTO,
  botonPrimario,
  botonTexto,
  tarjeta,
} from './tema';

export interface PopupSugerenciaProps {
  visible: boolean;
  tipo: 'Pregunta';
  texto: string;
  motivo: string;
  fuente: string;
  oportunidad: string;
  apilado: boolean;
  alHacerla: () => void;
  alPosponer: () => void;
  alDescartar: () => void;
}

const estiloCerrar: CSSProperties = {
  border: 'none',
  backgroundColor: 'transparent',
  color: TERCIARIO,
  fontSize: '1.2rem',
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
  marginLeft: '6px',
  width: '24px',
  height: '24px',
  borderRadius: '9999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function PopupSugerencia(props: PopupSugerenciaProps) {
  const { visible, tipo, texto, motivo, fuente, oportunidad, apilado, alHacerla, alPosponer, alDescartar } = props;
  if (!visible) return null;

  const posicion: CSSProperties = apilado
    ? { left: '16px', right: '16px', bottom: '16px', width: 'auto' }
    : { right: '24px', bottom: '24px', width: '380px' };

  return (
    <>
      <style>{`@keyframes popupSugerenciaEntra { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Sugerencia para el vendedor"
        style={{
          ...tarjeta,
          ...posicion,
          position: 'fixed',
          zIndex: 50,
          maxWidth: 'calc(100vw - 32px)',
          padding: '18px 20px 16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          borderLeft: `3px solid ${AZUL}`,
          animation: 'popupSugerenciaEntra 220ms ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.06em', fontWeight: 700, color: AZUL_TEXTO, textTransform: 'uppercase' }}>
            {tipo}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: AZUL_TEXTO, backgroundColor: '#eaf7ff', borderRadius: '9999px', padding: '3px 9px' }}>
            {oportunidad}
          </span>
          <button type="button" aria-label="Descartar sugerencia" onClick={alDescartar} style={estiloCerrar}>
            ×
          </button>
        </div>
        <p style={{ margin: '10px 0 6px', fontSize: '1.15rem', fontWeight: 700, color: TEXTO, lineHeight: 1.3 }}>
          {texto}
        </p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: SECUNDARIO }}>
          <span style={{ fontWeight: 600 }}>Por qué:</span> {motivo}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: TERCIARIO }}>{fuente}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" onClick={alPosponer} style={{ ...botonTexto, color: SECUNDARIO, fontSize: '0.9rem' }}>
              Ahora no
            </button>
            <button type="button" onClick={alHacerla} style={{ ...botonPrimario, padding: '9px 16px', fontSize: '0.9rem' }}>
              Ya la hice
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
