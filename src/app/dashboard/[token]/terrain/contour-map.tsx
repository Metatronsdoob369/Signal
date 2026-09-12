import type { Terrain } from "@/lib/terrain/build";
import { contourPaths, sampleField } from "@/lib/terrain/field";
import { temperatureHex } from "@/lib/terrain/temperature";

const SIZE = 1000;
const EXTENT = 1.25;
const GRID = 96;
const LEVELS = 14;

function toSvg(coordinate: number): number {
  return ((coordinate + EXTENT) / (2 * EXTENT)) * SIZE;
}

/** Reduced motion and no-WebGL surface: the same field, drawn as contours. */
export function ContourMap({ terrain, focusPath }: { terrain: Terrain; focusPath: string | null }) {
  const field = sampleField(terrain, { cols: GRID, rows: GRID, extent: EXTENT });
  const paths = contourPaths(field, { levels: LEVELS, width: SIZE, height: SIZE });

  return (
    <svg
      className="terrain-contour"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Contour map of ${terrain.domain}`}
      data-testid="terrain-contour"
    >
      <defs>
        {terrain.points.map((point, index) => (
          <radialGradient key={point.id} id={`heat-${index}`}>
            <stop offset="0%" stopColor={temperatureHex(point.heat)} stopOpacity="0.75" />
            <stop offset="55%" stopColor={temperatureHex(point.heat)} stopOpacity="0.28" />
            <stop offset="100%" stopColor={temperatureHex(point.heat)} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {terrain.points.map((point, index) => (
        <circle
          key={`glow-${point.id}`}
          cx={toSvg(point.position[0])}
          cy={toSvg(point.position[2])}
          r={70 + point.substance * 260}
          fill={`url(#heat-${index})`}
        />
      ))}
      {paths.map((d, index) =>
        d ? (
          <path
            key={index}
            d={d}
            fill="none"
            stroke="#8a9a86"
            strokeWidth={index % 3 === 2 ? 1.6 : 0.9}
            opacity={index % 3 === 2 ? 0.55 : 0.32}
            strokeLinecap="round"
          />
        ) : null,
      )}
      {terrain.points.map((point) => {
        const cx = toSvg(point.position[0]);
        const cy = toSvg(point.position[2]);
        const focused = point.path === focusPath;
        return (
          <g key={`point-${point.id}`}>
            <circle cx={cx} cy={cy} r={focused ? 9 : 7} fill={temperatureHex(point.heat)} stroke="#0a0b0d" strokeWidth={2} />
            <text x={cx + 16} y={cy + 5} className="terrain-contour-label">
              {point.path} · {Math.round(point.scores.overall)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
