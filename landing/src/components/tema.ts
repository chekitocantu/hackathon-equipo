import { useEffect, useState, type CSSProperties } from 'react';

// Paleta sobria: grises claros, un solo azul de marca y color solo donde significa algo.
export const FONDO = '#f5f5f7';
export const TEXTO = '#1d1d1f';
export const SECUNDARIO = '#6e6e73';
export const TERCIARIO = '#86868b';
export const SEPARADOR = '#e5e5ea';
export const AZUL = '#00b8ff';
export const AZUL_TEXTO = '#0077b6';
export const AZUL_BOTON = '#0091d5';
export const NARANJA = '#ff9f0a';
export const NARANJA_TEXTO = '#b25000';
export const VERDE = '#34c759';
export const VERDE_TEXTO = '#248a3d';
export const MORADO = '#af52de';
export const MORADO_TEXTO = '#8944ab';
export const ROJO = '#ff3b30';

// Por debajo de este ancho no caben las columnas y se apila todo (ahí sí hay scroll).
export const ANCHO_MINIMO_PANTALLA_COMPLETA = 1100;

export const tarjeta: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '20px',
  padding: '20px 24px',
  boxSizing: 'border-box',
};

export const tituloTarjeta: CSSProperties = {
  margin: 0,
  fontSize: '1.15rem',
  fontWeight: 700,
  letterSpacing: '-0.015em',
  color: TEXTO,
};

export const botonPrimario: CSSProperties = {
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

export const botonTexto: CSSProperties = {
  backgroundColor: 'transparent',
  color: AZUL_TEXTO,
  border: 'none',
  padding: '10px 6px',
  fontSize: '0.95rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export const fila: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  borderBottom: `1px solid ${SEPARADOR}`,
};

/** Contenedor de página completa: alto exacto de la ventana para que el vendedor no tenga que hacer scroll. */
export const pagina = (apilado: boolean): CSSProperties => ({
  height: apilado ? 'auto' : '100vh',
  minHeight: '100vh',
  width: '100%',
  backgroundColor: FONDO,
  color: TEXTO,
  fontFamily: 'var(--font-sans)',
  padding: '14px clamp(16px, 2.2vw, 32px)',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const moneda = (valor: number) => `$${Math.round(valor).toLocaleString('en-US')}`;

export function useAnchoVentana() {
  const [ancho, setAncho] = useState(() => window.innerWidth);
  useEffect(() => {
    const alCambiar = () => setAncho(window.innerWidth);
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  return ancho;
}
