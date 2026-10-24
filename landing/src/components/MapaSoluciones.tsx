import { NODOS, type EstadoNodo, type Etapa, type NodoMapa } from '../lib/simulacion';

// Filas del mapa: familia → solución → dato de dimensionamiento.
const Y = [16, 128, 228];
const ALTO = [64, 46, 46];

const COLORES: Record<EstadoNodo, { fondo: string; borde: string; texto: string; sub: string }> = {
  activo: { fondo: '#eaf7ff', borde: '#8fd7f7', texto: '#00507a', sub: '#0077b6' },
  pendiente: { fondo: '#fff6eb', borde: '#ffb84d', texto: '#9a4a00', sub: '#b25000' },
  inactivo: { fondo: '#f5f5f7', borde: '#f5f5f7', texto: '#aeaeb2', sub: '#c7c7cc' },
};

const TRANSICION = 'opacity 0.5s ease, transform 0.5s ease, fill 0.5s ease, stroke 0.5s ease';

// Las familias siempre se ven (en gris si no hay señal); lo demás aparece solo cuando el agente lo detecta.
function estadoDe(etapa: Etapa, nodo: NodoMapa): EstadoNodo | null {
  return etapa.nodos[nodo.id] ?? (nodo.nivel === 0 ? 'inactivo' : null);
}

function subtitulo(etapa: Etapa, nodo: NodoMapa, estado: EstadoNodo) {
  const activos = NODOS.filter((h) => h.padre === nodo.id && etapa.nodos[h.id] === 'activo').length;
  if (estado === 'inactivo') return 'Sin señal aún';
  if (estado === 'pendiente' && activos === 0) return 'Falta 1 dato';
  if (nodo.totalServicios) return `${activos} de ${nodo.totalServicios} servicios`;
  return activos === 1 ? '1 solución' : `${activos} soluciones`;
}

function etiquetaDe(etapa: Etapa, nodo: NodoMapa, estado: EstadoNodo | null) {
  if (etapa.etiquetas?.[nodo.id]) return etapa.etiquetas[nodo.id];
  if (estado === 'pendiente' && nodo.etiquetaPendiente) return nodo.etiquetaPendiente;
  return nodo.etiqueta;
}

export default function MapaSoluciones({ etapa }: { etapa: Etapa }) {
  const porId = new Map(NODOS.map((n) => [n.id, n]));
  const sinSoluciones = !NODOS.some((n) => n.nivel > 0 && etapa.nodos[n.id]);

  return (
    <svg
      viewBox="0 0 1080 290"
      role="img"
      aria-label="Mapa de soluciones detectadas en la llamada"
      // Ocupa todo el contenedor (que debe tener position relative) y se escala sin deformarse.
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    >
      <text
        x={540}
        y={180}
        textAnchor="middle"
        style={{ fill: '#aeaeb2', fontSize: 16, opacity: sinSoluciones ? 1 : 0, transition: TRANSICION }}
      >
        Las soluciones se abren aquí conforme el cliente habla
      </text>
      {NODOS.filter((n) => n.padre).map((nodo) => {
        const padre = porId.get(nodo.padre!)!;
        const estado = estadoDe(etapa, nodo);
        const y1 = Y[padre.nivel] + ALTO[padre.nivel];
        const y2 = Y[nodo.nivel];
        const medio = (y1 + y2) / 2;
        return (
          <path
            key={`linea-${nodo.id}`}
            d={`M${padre.x} ${y1} C${padre.x} ${medio}, ${nodo.x} ${medio}, ${nodo.x} ${y2}`}
            fill="none"
            stroke={COLORES[estado ?? 'inactivo'].borde}
            strokeWidth={1.5}
            strokeDasharray={estado === 'pendiente' ? '5 5' : undefined}
            style={{ opacity: estado ? 1 : 0, transition: TRANSICION }}
          />
        );
      })}

      {NODOS.map((nodo) => {
        const estado = estadoDe(etapa, nodo);
        const color = COLORES[estado ?? 'inactivo'];
        const y = Y[nodo.nivel];
        const alto = ALTO[nodo.nivel];
        const esFamilia = nodo.nivel === 0;
        return (
          <g
            key={nodo.id}
            style={{
              opacity: estado ? 1 : 0,
              transform: `translateY(${estado ? 0 : -10}px)`,
              transition: TRANSICION,
            }}
          >
            <rect
              x={nodo.x - nodo.ancho / 2}
              y={y}
              width={nodo.ancho}
              height={alto}
              rx={esFamilia ? 16 : 12}
              strokeWidth={1.5}
              strokeDasharray={estado === 'pendiente' ? '5 5' : undefined}
              style={{ fill: color.fondo, stroke: color.borde, transition: TRANSICION }}
            />
            <text
              x={nodo.x}
              y={esFamilia ? y + 28 : y + alto / 2 + 5}
              textAnchor="middle"
              style={{
                fill: color.texto,
                fontSize: esFamilia ? 20 : 13.5,
                fontWeight: esFamilia ? 700 : 600,
                letterSpacing: esFamilia ? '-0.01em' : undefined,
                transition: TRANSICION,
              }}
            >
              {etiquetaDe(etapa, nodo, estado)}
            </text>
            {esFamilia && estado && (
              <text x={nodo.x} y={y + 50} textAnchor="middle" style={{ fill: color.sub, fontSize: 13.5, fontWeight: 400, transition: TRANSICION }}>
                {subtitulo(etapa, nodo, estado)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
