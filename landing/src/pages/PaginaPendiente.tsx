import { Link } from 'react-router-dom';

interface PaginaPendienteProps {
  titulo: string;
  descripcion: string;
}

// Página temporal para las rutas que todavía no existen. Mismo lenguaje visual que la landing.
export default function PaginaPendiente({ titulo, descripcion }: PaginaPendienteProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#090d16',
        backgroundImage:
          'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '22px',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          backgroundColor: '#00b8ff',
          color: '#ffffff',
          padding: '4px 16px',
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.18,
          borderRadius: '3px',
          boxShadow: '0 6px 20px rgba(0, 184, 255, 0.3)',
        }}
      >
        {titulo}
      </span>
      <p
        style={{
          color: '#cbd5e1',
          fontSize: '1.05rem',
          maxWidth: '520px',
          lineHeight: 1.5,
        }}
      >
        {descripcion}
      </p>
      <Link
        to="/"
        style={{
          backgroundColor: '#ffffff',
          color: '#000000',
          borderRadius: '9999px',
          padding: '10px 22px',
          fontSize: '0.95rem',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        ‹ Volver al inicio
      </Link>
    </div>
  );
}
