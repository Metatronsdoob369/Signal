import { describe, expect, it } from "vitest";
import { deriveContactActionsOver7d, deriveSpeedOver7d, deriveVisitsOver7d, type VisitRollupLike } from "./catalog";

const d = (s: string) => s; // ISO day passthrough for readability

describe("deriveVisitsOver7d", () => {
  it("computes counts and delta with sparkline", () => {
    const rollups: VisitRollupLike[] = [
      { day: d("2026-09-01"), visits: 10 },
      { day: d("2026-09-02"), visits: 20 },
      { day: d("2026-09-03"), visits: 30 },
      { day: d("2026-09-04"), visits: 40 },
      { day: d("2026-09-05"), visits: 50 },
      { day: d("2026-09-06"), visits: 60 },
      { day: d("2026-09-07"), visits: 70 },
      { day: d("2026-09-08"), visits: 80 },
      { day: d("2026-09-09"), visits: 90 },
      { day: d("2026-09-10"), visits: 100 },
    ];
    const now = new Date("2026-09-10T12:00:00Z");
    const m = deriveVisitsOver7d(rollups, now);
    expect(m.current).toBe(80 + 90 + 100 + 70 + 60 + 50 + 40); // 490
    expect(m.previous).toBe(10 + 20 + 30 + 40 + 50 + 60 + 70); // 280
    expect(m.delta).toBe(210);
    expect(m.series?.length).toBe(7);
    expect(m.sampleSize).toBe(m.current);
  });
});

describe("deriveContactActionsOver7d", () => {
  it("sums contacts by day", () => {
    const rollups: VisitRollupLike[] = [
      { day: d("2026-09-04"), visits: 40, contacts: 2 },
      { day: d("2026-09-05"), visits: 50, contacts: 3 },
      { day: d("2026-09-06"), visits: 60, contacts: 5 },
      { day: d("2026-09-07"), visits: 70, contacts: 7 },
    ];
    const now = new Date("2026-09-07T23:10:00Z");
    const m = deriveContactActionsOver7d(rollups, now);
    expect(m.current).toBe(2 + 3 + 5 + 7);
    expect(m.previous).toBe(0); // no data previous window
    expect(m.delta).toBeNull(); // delta only when both present
  });
});

describe("deriveSpeedOver7d", () => {
  it("scores p75 vitals per day and averages over 7d", () => {
    const rollups: VisitRollupLike[] = [
      { day: d("2026-09-01"), visits: 10, lcpP75: 2600, inpP75: 210, clsP75: 0.11 },
      { day: d("2026-09-02"), visits: 10, lcpP75: 3000, inpP75: 300, clsP75: 0.15 },
      { day: d("2026-09-03"), visits: 10, lcpP75: 3500, inpP75: 400, clsP75: 0.2 },
      { day: d("2026-09-04"), visits: 10, lcpP75: 4000, inpP75: 500, clsP75: 0.25 },
      { day: d("2026-09-05"), visits: 10, lcpP75: 2000, inpP75: 180, clsP75: 0.08 },
      { day: d("2026-09-06"), visits: 10, lcpP75: 2500, inpP75: 200, clsP75: 0.1 },
      { day: d("2026-09-07"), visits: 10, lcpP75: 2400, inpP75: 210, clsP75: 0.09 },
    ];
    const now = new Date("2026-09-07T12:00:00Z");
    const m = deriveSpeedOver7d(rollups, now);
    expect(m.current).not.toBeNull();
    expect(m.sampleSize).toBe(70);
    expect(m.windowLabel).toBe("last 7 days");
    expect(m.series && m.series.length).toBe(7);
  });
});

