import { CrabPattern } from "../engine";
import { buildCrabFigures } from "../figures";

describe("Crab figures", () => {
  it("renders the zigzag, ratio guides, target, stop, pivots and entry", () => {
    const pattern: CrabPattern = {
      setupId: "bullish-crab-1",
      kind: "bullish_crab",
      direction: "LONG",
      pivots: [
        { timestamp: 1, index: 0, value: 100, kind: "low", traded: false },
        { timestamp: 2, index: 1, value: 120, kind: "high", traded: false },
        { timestamp: 3, index: 2, value: 110, kind: "low", traded: false },
        { timestamp: 4, index: 3, value: 118, kind: "high", traded: false },
        { timestamp: 5, index: 4, value: 87.64, kind: "low", traded: true },
      ],
      targetPrice: 107.63848,
      stopLossPrice: 85.64,
      xaHeight: 20,
      adHeight: 32.36,
      patternHeightAtr: 4,
      patternAgeBars: 5,
      completionLagBars: 1,
      xToABars: 1,
      aToBBars: 1,
      bToCBars: 1,
      cToDBars: 1,
      xbRatio: 0.5,
      acRatio: 0.8,
      bdRatio: 3.795,
      xdRatio: 1.618,
      xdDeviationPct: 0,
      bXdDistanceHeightRatio: 0.809,
      minIntermediateXdDistanceHeightRatio: 0.809,
      timestamp: 6,
      close: 91,
    };

    const figures = buildCrabFigures({
      pattern,
      entryTimestamp: 6,
      entryPrice: 91,
    });

    expect(figures.lines).toHaveLength(7);
    expect(figures.points).toHaveLength(2);
    expect(figures.lines?.map((line) => line.kind)).toEqual([
      "crab_bullish_crab_pattern",
      "crab_xd_reference",
      "crab_xb_ratio",
      "crab_ac_ratio",
      "crab_bd_ratio",
      "crab_target",
      "crab_stop",
    ]);
    expect(figures.points?.[0]?.points).toHaveLength(5);
  });
});
