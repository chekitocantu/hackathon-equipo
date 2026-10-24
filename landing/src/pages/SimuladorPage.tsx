import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Tablero, { Segmentado } from '../components/Tablero';
import { ANCHO_MINIMO_PANTALLA_COMPLETA, AZUL_TEXTO, pagina, SECUNDARIO, TEXTO, useAnchoVentana } from '../components/tema';
import { GUIONES } from '../lib/casos';
import { informacionQueFalta } from '../lib/catalogo';

const SEGUNDOS_POR_ETAPA = 6;

export default function SimuladorPage() {
  const [indiceCaso, setIndiceCaso] = useState(0);
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const apilado = useAnchoVentana() < ANCHO_MINIMO_PANTALLA_COMPLETA;

  const guion = GUIONES[indiceCaso];
  const { caso } = guion;
  const etapa = guion.etapas[indice];
  const ultima = guion.etapas.length - 1;

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

  const cambiarCaso = (i: number) => {
    setReproduciendo(false);
    setIndiceCaso(i);
    setIndice(0);
  };

  const reproducir = () => {
    if (indice >= ultima) setIndice(0);
    setReproduciendo((r) => !r);
  };

  return (
    <div style={pagina(apilado)}>
      {/* ── Encabezado: cliente elegido ── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: apilado ? 'wrap' : 'nowrap' }}>
        <div style={{ flexShrink: 0, minWidth: 0 }}>
          <Link to="/" style={{ color: AZUL_TEXTO, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
            ‹ Inicio
          </Link>
          <h1 style={{ margin: '2px 0 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>{caso.empresa}</h1>
          <p style={{ margin: '3px 0 0', fontSize: '0.92rem', color: SECUNDARIO }}>
            {caso.industria} · {caso.ciudad} · {caso.empleados.toLocaleString('en-US')} empleados · {etapa.minuto}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', width: apilado ? '100%' : 'min(560px, 48%)' }}>
          <Segmentado
            etiqueta="Caso del simulador"
            elegido={indiceCaso}
            alElegir={cambiarCaso}
            opciones={GUIONES.map((g) => ({ id: g.caso.id, titulo: g.nombreCorto, sub: g.caso.industria }))}
          />
        </div>
      </header>

      {/* ── Línea de tiempo de la llamada ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <Segmentado
            etiqueta="Momentos de la llamada"
            elegido={indice}
            alElegir={irA}
            opciones={guion.etapas.map((e) => ({ id: e.id, titulo: e.nombre, sub: `${e.minuto} · ${e.resumen}` }))}
          />
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

      <Tablero
        key={caso.id}
        apilado={apilado}
        mensaje={{
          rotulo: `Cliente · ${etapa.minuto}${indice === 0 ? ' · primer mensaje del catálogo' : ''}`,
          texto: etapa.cliente,
          vacio: '',
        }}
        productos={etapa.productos}
        datos={informacionQueFalta(caso).map((etiqueta, i) => ({ etiqueta, valor: etapa.datos[i] }))}
        reglas={etapa.reglas}
        pregunta={etapa.pregunta}
        alHacerPregunta={() => irA(indice + 1)}
      />
    </div>
  );
}
