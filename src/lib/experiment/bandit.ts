export type BanditRow = {
  id: string;
  impressions: number;
  successes: number;
};

function randn(): number {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function gammaSample(shape: number): number {
  if (shape < 1) return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x = 0;
    let vv = 0;
    do {
      x = randn();
      vv = 1 + c * x;
    } while (vv <= 0);
    vv = vv * vv * vv;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * vv;
    if (Math.log(u) < 0.5 * x * x + d * (1 - vv + Math.log(vv))) return d * vv;
  }
}

export function betaSample(alpha: number, beta: number): number {
  const x = gammaSample(alpha);
  return x / (x + gammaSample(beta));
}

export function pickVariant<T extends BanditRow>(
  rows: T[],
  sampleBeta: (alpha: number, beta: number) => number = betaSample,
): T | null {
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0] ?? null;
  let best: T | null = null;
  let bestDraw = -1;
  for (const row of rows) {
    const successes = row.successes || 0;
    const impressions = row.impressions || 0;
    const alpha = successes + 1;
    const beta = Math.max(1, impressions - successes) + 1;
    const draw = sampleBeta(alpha, beta);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = row;
    }
  }
  return best;
}
