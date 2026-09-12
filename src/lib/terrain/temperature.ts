/**
 * The law: temperature is health. Hot good, cold bad, on every surface.
 * Heat is the overall score as a share; bands match the thresholds the dashboard already uses.
 */
export type TerrainZone = "hot" | "warm" | "cold";
export type TerrainKind = "canonical" | "pending" | "shattered";
export type TerrainRecommendation = "ANCHOR" | "REVIEW" | "SHATTER_RESOLVE";

export const HEAT_BANDS = { hot: 0.8, warm: 0.6 } as const;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function heatFromScore(score: number): number {
  return clamp01(score / 100);
}

export function classifyHeat(heat: number): {
  zone: TerrainZone;
  kind: TerrainKind;
  recommendation: TerrainRecommendation;
} {
  if (heat >= HEAT_BANDS.hot) return { zone: "hot", kind: "canonical", recommendation: "ANCHOR" };
  if (heat >= HEAT_BANDS.warm) return { zone: "warm", kind: "pending", recommendation: "REVIEW" };
  return { zone: "cold", kind: "shattered", recommendation: "SHATTER_RESOLVE" };
}

type Rgb = [number, number, number];

/** sRGB stops. Cold is slate and ash, warm is bronze, hot is copper. No green, no cyan, no neon. */
const RAMP: Array<{ at: number; rgb: Rgb }> = [
  { at: 0, rgb: [0x2c / 255, 0x33 / 255, 0x40 / 255] },
  { at: 0.4, rgb: [0x6b / 255, 0x6f / 255, 0x78 / 255] },
  { at: HEAT_BANDS.warm, rgb: [0x7d / 255, 0x5f / 255, 0x47 / 255] },
  { at: HEAT_BANDS.hot, rgb: [0xb9 / 255, 0x74 / 255, 0x3a / 255] },
  { at: 1, rgb: [0xe0 / 255, 0x97 / 255, 0x5a / 255] },
];

export function temperatureRgb(heat: number): Rgb {
  const h = clamp01(heat);
  for (let i = 1; i < RAMP.length; i++) {
    const lo = RAMP[i - 1];
    const hi = RAMP[i];
    if (h <= hi.at) {
      const t = (h - lo.at) / (hi.at - lo.at);
      return [
        lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t,
        lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t,
        lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t,
      ];
    }
  }
  return RAMP[RAMP.length - 1].rgb;
}

export function temperatureHex(heat: number): string {
  const [r, g, b] = temperatureRgb(heat).map((c) => Math.round(clamp01(c) * 255));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
