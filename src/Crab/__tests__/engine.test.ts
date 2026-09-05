/** @jest-environment node */

import { config as DEFAULT_CONFIG } from "../config";
import { createCrabEngine } from "../engine";

const makeCandle = (
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
) => ({
  timestamp: 1_700_000_000_000 + index * 60_000,
  dt: new Date(1_700_000_000_000 + index * 60_000).toISOString(),
  open,
  high,
  low,
  close,
  volume: 1_000,
  turnover: close * 1_000,
});

const makeConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    ...DEFAULT_CONFIG,
    CRAB_PIVOT_LENGTH: 1,
    CRAB_MIN_PATTERN_HEIGHT_PCT: 0,
    CRAB_MIN_PATTERN_HEIGHT_ATR: 0,
    ...overrides,
  }) as any;

export const makeBullishCrabCandles = ({
  b = 110,
  c = 118,
  d = 87.64,
}: {
  b?: number;
  c?: number;
  d?: number;
} = {}) => [
  makeCandle(0, 103, 104, 102, 103),
  makeCandle(1, 102, 103, 100, 101),
  makeCandle(2, 106, 110, 104, 108),
  makeCandle(3, 116, 120, 115, 119),
  makeCandle(4, b + 3, Math.max(b + 6, 116), b + 2, b + 3),
  makeCandle(5, b + 2, b + 4, b, b + 1),
  makeCandle(6, b + 1, c - 1, b + 0.5, b + 1.5),
  makeCandle(7, c - 2, c, c - 3, c - 1),
  makeCandle(8, d + 10, c - 2, d + 8, d + 9),
  makeCandle(9, d + 3, d + 7, d, d + 2),
  makeCandle(10, d + 2, d + 5, d + 1, d + 3.36),
];

const mirrorCandles = (candles: ReturnType<typeof makeBullishCrabCandles>) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

describe("Crab engine", () => {
  it("detects a bullish Crab when D completes below X", () => {
    const engine = createCrabEngine({ config: makeConfig() });
    const states = makeBullishCrabCandles().map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bullish_crab");
    expect(pattern?.direction).toBe("LONG");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      100, 120, 110, 118, 87.64,
    ]);
    expect(pattern?.xbRatio).toBeCloseTo(0.5);
    expect(pattern?.acRatio).toBeCloseTo(0.8);
    expect(pattern?.bdRatio).toBeCloseTo(3.795);
    expect(pattern?.xdRatio).toBeCloseTo(1.618);
    expect(pattern?.targetPrice).toBeCloseTo(107.63848);
    expect(pattern?.stopLossPrice).toBeCloseTo(85.64);
    expect(pattern?.bXdDistanceHeightRatio).toBeGreaterThan(0.8);
  });

  it("detects the mirrored bearish Crab", () => {
    const engine = createCrabEngine({ config: makeConfig() });
    const states = mirrorCandles(makeBullishCrabCandles()).map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bearish_crab");
    expect(pattern?.direction).toBe("SHORT");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      120, 100, 110, 102, 132.36,
    ]);
    expect(pattern?.xdRatio).toBeCloseTo(1.618);
    expect(pattern?.targetPrice).toBeLessThan(pattern?.close ?? 0);
    expect(pattern?.stopLossPrice).toBeGreaterThan(pattern?.close ?? Infinity);
  });

  it("rejects XB outside the configured 0.38-0.61 range", () => {
    const engine = createCrabEngine({ config: makeConfig() });
    const state = makeBullishCrabCandles({ b: 105 }).reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects AC outside the configured 0.38-0.88 range", () => {
    const engine = createCrabEngine({ config: makeConfig() });
    const state = makeBullishCrabCandles({ c: 113 }).reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects BD outside the configured 2.24-4.23 range", () => {
    const engine = createCrabEngine({
      config: makeConfig({ CRAB_XD_TOLERANCE_PCT: 100 }),
    });
    const state = makeBullishCrabCandles({ d: 83.9 }).reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects XD outside the tolerance around 1.618", () => {
    const engine = createCrabEngine({ config: makeConfig() });
    const state = makeBullishCrabCandles({ d: 92 }).reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("requires B to remain visibly separated from the X-D line", () => {
    const engine = createCrabEngine({
      config: makeConfig({ CRAB_MIN_B_XD_DISTANCE_HEIGHT_RATIO: 0.82 }),
    });
    const state = makeBullishCrabCandles().reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("emits a completed setup once and rebuilds it from initial candles", () => {
    const candles = makeBullishCrabCandles();
    const continuous = createCrabEngine({ config: makeConfig() });
    const completed = candles.reduce(
      (_, candle) => continuous.next(candle as any),
      continuous.getState(),
    );

    const restored = createCrabEngine({
      config: makeConfig(),
      initialCandles: candles.slice(0, -1) as any,
    });
    expect(restored.next(candles[candles.length - 1] as any)).toEqual(
      completed,
    );

    const next = makeCandle(11, 91, 94, 90, 93);
    expect(continuous.next(next as any).pattern).toBeNull();
  });
});
