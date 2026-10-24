import { Link } from 'react-router-dom';
import USAMapBackground from '../USAmap';

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#f8fafc',
        backgroundImage:
          'linear-gradient(to right, rgba(0, 0, 0, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* Contenedor a todo lo ancho: el hero llega de orilla a orilla */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          minHeight: '100vh',
        }}
      >
        {/* ── Hero en dos columnas: texto a la izquierda, video a la derecha sin nada encima ── */}
        <section
          style={{
            width: '100%',
            minHeight: 'clamp(460px, 70vh, 640px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            alignItems: 'stretch',
            boxSizing: 'border-box',
            backgroundColor: '#090d16',
            backgroundImage:
              'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          }}
        >
        {/* Columna de texto */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            textAlign: 'left',
            padding: 'clamp(36px, 6vw, 80px) clamp(20px, 5vw, 72px)',
            boxSizing: 'border-box',
          }}
        >
          {/* ── Main Highlighted Title ── */}
          <h1
            style={{
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '6px',
            }}
          >
            <span
              style={{
                backgroundColor: '#00b8ff',
                color: '#ffffff',
                padding: '4px 16px',
                fontSize: 'clamp(2rem, 4.6vw, 3.4rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.18,
                display: 'inline-block',
                borderRadius: '3px',
                boxShadow: '0 6px 20px rgba(0, 184, 255, 0.3)',
              }}
            >
              Tu arquitecto de soluciones, en vivo en cada llamada.
            </span>
          </h1>

          {/* ── Subtitle ── */}
          <p
            style={{
              color: '#e2e8f0',
              fontSize: 'clamp(1.05rem, 1.6vw, 1.3rem)',
              fontWeight: 500,
              maxWidth: '520px',
              marginTop: '24px',
              marginBottom: '30px',
              lineHeight: 1.5,
              letterSpacing: '-0.01em',
            }}
          >
            Pregunta lo correcto desde la primera reunión y entrega la propuesta antes de colgar.
          </p>

          {/* ── CTA Buttons ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/simulador"
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                borderRadius: '9999px',
                padding: '15px 34px',
                fontSize: '1.2rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
                boxShadow: '0 4px 14px rgba(255, 255, 255, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.opacity = '0.92';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              Abre el simulador ›
            </Link>

            <Link
              to="/llamada"
              style={{
                backgroundColor: '#00b8ff',
                color: '#ffffff',
                borderRadius: '9999px',
                padding: '15px 34px',
                fontSize: '1.2rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
                boxShadow: '0 4px 14px rgba(0, 184, 255, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.opacity = '0.92';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              Enlaza tu llamada ›
            </Link>
          </div>
        </div>

        {/* Columna del video: ocupa todo su espacio y no lleva nada encima */}
        <div style={{ position: 'relative', minHeight: '320px', overflow: 'hidden' }}>
          <USAMapBackground
            src="/hero-vendedor.mp4"
            pixelSize={6}
            shapeMode="random"
            showGrid={true}
            colorMode="greyscale"
            overlayOpacity={0}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
        </div>
      </section>

      {/* ── Sección de Contenido Grid y Columna de 2 ── */}
      <section
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '54px 20px 80px 20px',
          boxSizing: 'border-box',
        }}
      >
        {/* Encabezado de la sección de hallazgos */}
        <div style={{ marginBottom: '32px', textAlign: 'left' }}>
          <h2
            style={{
              fontSize: 'clamp(1.8rem, 3.2vw, 2.4rem)',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              margin: '0 0 10px 0',
            }}
          >
            Tu <span style={{ color: '#00b8ff' }}>Agente de Ventas</span> escucha, pregunta y cotiza contigo.
          </h2>
          <p
            style={{
              fontSize: '1.05rem',
              color: '#475569',
              margin: 0,
              lineHeight: 1.5,
              maxWidth: '680px',
            }}
          >
            Traduce lo que dice el cliente a productos del catálogo y te sopla la siguiente pregunta en pantalla. Solo usa precios y datos del catálogo, sin inventar cifras.
          </p>
        </div>

        {/* Grid de 2 Columnas (Pixel Canvas con fondo claro + Botón interactivo al lado) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
          }}
        >
          {/* Columna 1: Pixel Canvas Background actual (SIN FONDO NEGRO, Estilo Grid Blueprint Claro) */}
          <div
            style={{
              position: 'relative',
              borderRadius: '16px',
              overflow: 'hidden',
              minHeight: '360px',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >

            {/* Video del agente: ya viene en pixeles, se muestra tal cual. Arranca y se repite desde el segundo 1. */}
            <video
              src="/pixel-video-1792872278854.webm"
              autoPlay
              muted
              playsInline
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = 1;
              }}
              onEnded={(e) => {
                e.currentTarget.currentTime = 1;
                void e.currentTarget.play();
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 1,
              }}
            />
          </div>

          {/* Columna 2: Tarjeta al lado con el Botón y estilo Grid */}
          <div
            style={{
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              backgroundImage:
                'linear-gradient(to right, #f8fafc 1px, transparent 1px), linear-gradient(to bottom, #f8fafc 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
              padding: 'clamp(28px, 4vw, 36px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              textAlign: 'left',
              gap: '20px',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
           
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>


              <h3
                style={{
                  fontSize: 'clamp(1.3rem, 2.2vw, 1.7rem)',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.25,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Del primer contacto a la propuesta, en una sola reunión
              </h3>

              <p
                style={{
                  fontSize: '0.95rem',
                  color: '#64748b',
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                Practica con el simulador o enlaza tu llamada real: el agente detecta lo que falta preguntar, separa lo estándar de lo a la medida y te dice cuándo sí hace falta un arquitecto.
              </p>

              {/* Puntos técnicos de grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#334155', fontWeight: 600 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                  Alertas en vivo de lo que falta preguntar
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#334155', fontWeight: 600 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                  Traducción de la necesidad del cliente al catálogo
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#334155', fontWeight: 600 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                  Propuesta económica con precios reales del catálogo
                </div>
              </div>
            </div>

            {/* El botón de acción */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', marginTop: '8px' }}>
              <Link
                to="/llamada"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '12px 26px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)',
                  transition: 'all 0.15s ease',
                  border: '1px solid #0f172a',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#00b8ff';
                  e.currentTarget.style.borderColor = '#00b8ff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 184, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0f172a';
                  e.currentTarget.style.borderColor = '#0f172a';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.15)';
                }}
              >
                Enlaza tu llamada
              </Link>

              <Link
                to="/simulador"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 20px',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  border: '1px solid #cbd5e1',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                 Abrir simulador ›
              </Link>
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
