import type { CSSProperties } from 'react';
import { familia, producto, unidadDe } from '../lib/catalogo';
import type { EstadoProducto, ProductoEnEtapa } from '../lib/cotizador';

// Filas del mapa: familia → producto detectado → cantidad o motivo.
const ANCHO = 1080;
const Y = [8, 112, 206];
const ALTO = [58, 52, 38];

export const COLORES: Record<EstadoProducto, { fondo: string; borde: string; texto: string; sub: string; punteado?: boolean }> = {
  incluido: { fondo: '#eaf7ff', borde: '#8fd7f7', texto: '#00507a', sub: '#0077b6' },
  pendiente: { fondo: '#fff6eb', borde: '#ffb84d', texto: '#9a4a00', sub: '#b25000', punteado: true },
  arquitecto: { fondo: '#f6effc', borde: '#d4b3ee', texto: '#5e2585', sub: '#8944ab' },
  sugerido: { fondo: '#ffffff', borde: '#c7c7cc', texto: '#6e6e73', sub: '#86868b', punteado: true },
};

const MOVIMIENTO = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), d 0.5s cubic-bezier(0.4, 0, 0.2, 1)';

interface Nodo {
  id: string;
  x: number;
  ancho: number;
  estado: EstadoProducto;
  lineas: string[];
  detalle: string | null;
}

/** Parte un texto en máximo dos renglones que quepan en el ancho del nodo. */
function partir(texto: string, ancho: number, tamano: number) {
  const max = Math.max(6, Math.floor((ancho - 18) / (tamano * 0.56)));
  const renglones: string[] = [];
  for (const palabra of texto.split(' ')) {
    const ultimo = renglones[renglones.length - 1];
    if (ultimo !== undefined && (ultimo + ' ' + palabra).length <= max) renglones[renglones.length - 1] = ultimo + ' ' + palabra;
    else renglones.push(palabra);
  }
  if (renglones.length <= 2) return renglones;
  const segundo = renglones.slice(1).join(' ');
  return [renglones[0], segundo.length > max ? segundo.slice(0, max - 1).trimEnd() + '…' : segundo];
}

function detalleDe(p: ProductoEnEtapa): string | null {
  if (p.nota) return p.nota;
  if (p.estado === 'sugerido') return 'Sugerido';
  const unidad = unidadDe(producto(p.sku));
  if (!unidad) return null;
  return p.cantidad === undefined ? `¿Cuántos ${unidad}?` : `${p.cantidad} ${unidad}`;
}

// La familia toma el color de lo más urgente que tenga adentro.
function estadoFamilia(estados: EstadoProducto[]): EstadoProducto {
  if (estados.includes('pendiente')) return 'pendiente';
  if (estados.includes('incluido')) return 'incluido';
  if (estados.includes('arquitecto')) return 'arquitecto';
  return 'sugerido';
}

export default function MapaSoluciones({ productos }: { productos: ProductoEnEtapa[] }) {
  // Cada familia recibe un ancho proporcional a cuántos productos tiene.
  const familias: { id: string; productos: ProductoEnEtapa[] }[] = [];
  for (const p of productos) {
    const id = producto(p.sku).familia;
    const grupo = familias.find((f) => f.id === id);
    if (grupo) grupo.productos.push(p);
    else familias.push({ id, productos: [p] });
  }

  const porProducto = productos.length ? (ANCHO - 16) / productos.length : 0;
  let inicio = 8;
  const raices: (Nodo & { hijos: Nodo[] })[] = familias.map((f) => {
    const espacio = porProducto * f.productos.length;
    const hijos = f.productos.map((p, i) => {
      const ancho = Math.min(porProducto - 14, 220);
      return {
        id: p.sku,
        x: inicio + porProducto * (i + 0.5),
        ancho,
        estado: p.estado,
        lineas: partir(producto(p.sku).nombre, ancho, 13.5),
        detalle: detalleDe(p),
      };
    });
    const activos = f.productos.filter((p) => p.estado !== 'sugerido');
    const conArquitecto = activos.filter((p) => p.estado === 'arquitecto').length;
    const nodo = {
      id: f.id,
      x: inicio + espacio / 2,
      ancho: Math.min(espacio - 16, 320),
      estado: estadoFamilia(f.productos.map((p) => p.estado)),
      lineas: [familia(f.id).nombre],
      detalle:
        conArquitecto === activos.length && activos.length > 0
          ? 'Con arquitecto'
          : `${activos.length} ${activos.length === 1 ? 'producto' : 'productos'}${conArquitecto ? ` · ${conArquitecto} con arquitecto` : ''}`,
      hijos,
    };
    inicio += espacio;
    return nodo;
  });

  const curva = (x1: number, y1: number, x2: number, y2: number) => {
    const medio = (y1 + y2) / 2;
    return `M${x1} ${y1} C${x1} ${medio}, ${x2} ${medio}, ${x2} ${y2}`;
  };

  return (
    <svg
      viewBox={`0 0 ${ANCHO} 250`}
      role="img"
      aria-label="Mapa de soluciones detectadas en la llamada"
      // Ocupa todo el contenedor (que debe tener position relative) y se escala sin deformarse.
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    >
      {raices.length === 0 && (
        <text x={ANCHO / 2} y={125} textAnchor="middle" style={{ fill: '#aeaeb2', fontSize: 16 }}>
          Las soluciones se abren aquí conforme el cliente habla
        </text>
      )}

      {raices.flatMap((r) =>
        r.hijos.flatMap((h) => {
          const color = COLORES[h.estado];
          const lineas = [
            <Linea key={`l-${h.id}`} d={curva(r.x, Y[0] + ALTO[0], h.x, Y[1])} color={color.borde} punteado={color.punteado} />,
          ];
          if (h.detalle) {
            lineas.push(
              <Linea key={`l2-${h.id}`} d={curva(h.x, Y[1] + ALTO[1], h.x, Y[2])} color={color.borde} punteado={color.punteado} />,
            );
          }
          return lineas;
        }),
      )}

      {raices.map((r) => (
        <Caja key={r.id} nodo={r} nivel={0} />
      ))}
      {raices.flatMap((r) => r.hijos.map((h) => <Caja key={h.id} nodo={h} nivel={1} />))}
      {raices.flatMap((r) =>
        r.hijos
          .filter((h) => h.detalle)
          .map((h) => (
            <Caja
              key={`d-${h.id}`}
              nivel={2}
              nodo={{ ...h, id: `d-${h.id}`, ancho: Math.min(h.ancho, 180), lineas: [h.detalle!], detalle: null }}
            />
          )),
      )}
    </svg>
  );
}

function Linea({ d, color, punteado }: { d: string; color: string; punteado?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray={punteado ? '5 5' : undefined}
      // `d` como propiedad CSS permite que la curva se deslice junto con los nodos.
      style={{ d: `path('${d}')`, transition: MOVIMIENTO, animation: 'aparecer 0.45s ease both' } as CSSProperties}
    />
  );
}

function Caja({ nodo, nivel }: { nodo: Nodo; nivel: 0 | 1 | 2 }) {
  const color = COLORES[nodo.estado];
  const alto = ALTO[nivel];
  const tamano = nivel === 0 ? 19 : nivel === 1 ? 13.5 : 12.5;
  const interlineado = tamano + 3;
  const conDetalle = nivel === 0 && nodo.detalle;
  const bloque = nodo.lineas.length * interlineado + (conDetalle ? 18 : 0);
  const primerRenglon = (alto - bloque) / 2 + tamano - 2;

  return (
    <g style={{ transform: `translate(${nodo.x}px, ${Y[nivel]}px)`, transition: MOVIMIENTO, animation: 'aparecer 0.45s ease both' }}>
      <rect
        x={-nodo.ancho / 2}
        y={0}
        width={nodo.ancho}
        height={alto}
        rx={nivel === 0 ? 16 : 12}
        strokeWidth={1.5}
        strokeDasharray={color.punteado ? '5 5' : undefined}
        style={{ fill: color.fondo, stroke: color.borde, transition: 'fill 0.4s ease, stroke 0.4s ease' }}
      />
      <text textAnchor="middle" style={{ fill: nivel === 2 ? color.sub : color.texto, fontSize: tamano, fontWeight: nivel === 2 ? 600 : 700 }}>
        {nodo.lineas.map((l, i) => (
          <tspan key={i} x={0} y={primerRenglon + i * interlineado}>
            {l}
          </tspan>
        ))}
      </text>
      {conDetalle && (
        <text x={0} y={primerRenglon + nodo.lineas.length * interlineado + 2} textAnchor="middle" style={{ fill: color.sub, fontSize: 13 }}>
          {nodo.detalle}
        </text>
      )}
    </g>
  );
}
