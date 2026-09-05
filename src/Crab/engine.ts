import { Candle, Direction } from "@tradejs/types";
import { CrabConfig } from "./config";

export type CrabPatternKind = "bullish_crab" | "bearish_crab";
export type CrabPivotRole = "x" | "a" | "b" | "c" | "d";

export interface CrabPivot {
  timestamp: number;
  index: number;
  value: number;
  kind: "high" | "low";
  traded: boolean;
}

export interface CrabPattern {
  setupId: string;
  kind: CrabPatternKind;
  direction: Direction;
  pivots: [CrabPivot, CrabPivot, CrabPivot, CrabPivot, CrabPivot];
  targetPrice: number;
  stopLossPrice: number;
  xaHeight: number;
  adHeight: number;
  patternHeightAtr: number;
  patternAgeBars: number;
  completionLagBars: number;
  xToABars: number;
  aToBBars: number;
  bToCBars: number;
  cToDBars: number;
  xbRatio: number;
  acRatio: number;
  bdRatio: number;
  xdRatio: number;
  xdDeviationPct: number;
  bXdDistanceHeightRatio: number;
  minIntermediateXdDistanceHeightRatio: number;
  timestamp: number;
  close: number;
}

export interface CrabRuntimeState {
  pattern: CrabPattern | null;
  pivots: CrabPivot[];
}

interface CandleRecord {
  candle: Candle;
  index: number;
}

interface EngineState {
  records: CandleRecord[];
  currentIndex: number;
  pivots: CrabPivot[];
  pattern: CrabPattern | null;
  consumedSetupIds: string[];
  lastTimestamp: number | null;
}

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const positiveNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const nonNegativeNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const getConfigNumbers = (config: CrabConfig) => {
  const minXbRatio = nonNegativeNumber(config.CRAB_MIN_XB_RATIO, 0.38);
  const minAcRatio = nonNegativeNumber(config.CRAB_MIN_AC_RATIO, 0.38);
  const minBdRatio = nonNegativeNumber(config.CRAB_MIN_BD_RATIO, 2.24);

  return {
    pivotLength: Math.max(1, Math.floor(config.CRAB_PIVOT_LENGTH ?? 2)),
    minXbRatio,
    maxXbRatio: Math.max(
      minXbRatio,
      nonNegativeNumber(config.CRAB_MAX_XB_RATIO, 0.61),
    ),
    minAcRatio,
    maxAcRatio: Math.max(
      minAcRatio,
      nonNegativeNumber(config.CRAB_MAX_AC_RATIO, 0.88),
    ),
    minBdRatio,
    maxBdRatio: Math.max(
      minBdRatio,
      nonNegativeNumber(config.CRAB_MAX_BD_RATIO, 4.23),
    ),
    xdRatio: positiveNumber(config.CRAB_XD_RATIO, 1.618),
    xdTolerancePct: nonNegativeNumber(config.CRAB_XD_TOLERANCE_PCT, 5),
    minBXdDistanceHeightRatio: nonNegativeNumber(
      config.CRAB_MIN_B_XD_DISTANCE_HEIGHT_RATIO,
      0.1,
    ),
    targetFibPct: nonNegativeNumber(config.CRAB_TARGET_FIB_PCT, 61.8),
    stopFibPct: nonNegativeNumber(config.CRAB_STOP_FIB_PCT, 10),
    minPatternHeightPct: nonNegativeNumber(
      config.CRAB_MIN_PATTERN_HEIGHT_PCT,
      0,
    ),
    minPatternHeightAtr: nonNegativeNumber(
      config.CRAB_MIN_PATTERN_HEIGHT_ATR,
      0,
    ),
    atrPeriod: Math.max(2, Math.floor(config.CRAB_ATR_PERIOD ?? 14)),
    minLegBars: Math.max(1, Math.floor(config.CRAB_MIN_LEG_BARS ?? 1)),
    maxPatternAgeBars: Math.max(
      5,
      Math.floor(config.CRAB_MAX_PATTERN_AGE_BARS ?? 240),
    ),
    maxCompletionLagBars: Math.max(
      1,
      Math.floor(config.CRAB_MAX_COMPLETION_LAG_BARS ?? 10),
    ),
  };
};

type EngineOptions = ReturnType<typeof getConfigNumbers>;

const calculateAtr = (
  records: CandleRecord[],
  period: number,
): number | null => {
  const relevant = records.slice(-(period + 1));
  if (relevant.length < 2) return null;
  const trueRanges: number[] = [];

  for (let index = 1; index < relevant.length; index += 1) {
    const candle = relevant[index]?.candle;
    const previous = relevant[index - 1]?.candle;
    const high = asNumber(candle?.high);
    const low = asNumber(candle?.low);
    const previousClose = asNumber(previous?.close);
    if (high == null || low == null || previousClose == null) continue;
    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }

  if (trueRanges.length === 0) return null;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
};

const pushBoundedRecord = (
  state: Pick<EngineState, "records" | "currentIndex">,
  candle: Candle,
  maxRecords: number,
) => {
  state.currentIndex += 1;
  state.records.push({ candle, index: state.currentIndex });
  if (state.records.length > maxRecords) {
    state.records.splice(0, state.records.length - maxRecords);
  }
};

const appendPivot = (state: EngineState, pivot: CrabPivot) => {
  const latest = state.pivots[state.pivots.length - 1];
  if (latest?.kind === pivot.kind) {
    if (latest.traded) return;
    const moreExtreme =
      pivot.kind === "high"
        ? pivot.value > latest.value
        : pivot.value < latest.value;
    if (moreExtreme) state.pivots[state.pivots.length - 1] = pivot;
    return;
  }

  state.pivots.push(pivot);
  if (state.pivots.length > 20) state.pivots.shift();
};

const detectConfirmedPivot = (state: EngineState, pivotLength: number) => {
  const windowLength = pivotLength * 2 + 1;
  if (state.records.length < windowLength) return;

  const centerPosition = state.records.length - pivotLength - 1;
  const start = centerPosition - pivotLength;
  const end = centerPosition + pivotLength + 1;
  if (start < 0) return;

  const window = state.records.slice(start, end);
  const center = state.records[centerPosition];
  const high = asNumber(center?.candle.high);
  const low = asNumber(center?.candle.low);
  if (!center || high == null || low == null) return;

  const highs = window.map(({ candle }) => asNumber(candle.high));
  const lows = window.map(({ candle }) => asNumber(candle.low));
  if (
    highs.some((value) => value === null) ||
    lows.some((value) => value === null)
  ) {
    return;
  }

  const isHigh =
    highs.every((value) => high >= (value as number)) &&
    highs.filter((value) => value === high).length === 1;
  const isLow =
    lows.every((value) => low <= (value as number)) &&
    lows.filter((value) => value === low).length === 1;
  if (isHigh === isLow) return;

  appendPivot(state, {
    timestamp: center.candle.timestamp,
    index: center.index,
    value: isHigh ? high : low,
    kind: isHigh ? "high" : "low",
    traded: false,
  });
};

const patternRolesForDirection = (direction: Direction) =>
  direction === "LONG"
    ? (["low", "high", "low", "high", "low"] as const)
    : (["high", "low", "high", "low", "high"] as const);

const findLatestPatternPivots = (
  state: EngineState,
  direction: Direction,
): [CrabPivot, CrabPivot, CrabPivot, CrabPivot, CrabPivot] | null => {
  const roles = patternRolesForDirection(direction);
  const firstCandidate = Math.max(0, state.pivots.length - 8);

  for (
    let index = state.pivots.length - 5;
    index >= firstCandidate;
    index -= 1
  ) {
    const candidate = state.pivots.slice(index, index + 5);
    if (
      candidate.length === 5 &&
      candidate.every((pivot, roleIndex) => pivot.kind === roles[roleIndex]) &&
      candidate[4]!.index < state.currentIndex &&
      !candidate[4]!.traded
    ) {
      return candidate as [
        CrabPivot,
        CrabPivot,
        CrabPivot,
        CrabPivot,
        CrabPivot,
      ];
    }
  }

  return null;
};

const projectLine = (start: CrabPivot, end: CrabPivot, index: number) => {
  const bars = end.index - start.index;
  if (bars <= 0) return start.value;
  return (
    start.value + ((end.value - start.value) * (index - start.index)) / bars
  );
};

const within = (value: number, min: number, max: number) =>
  value >= min && value <= max;

const hasConsumed = (state: EngineState, setupId: string) =>
  state.consumedSetupIds.includes(setupId);

const markConsumed = (
  state: EngineState,
  setupId: string,
  completion: CrabPivot,
) => {
  if (!hasConsumed(state, setupId)) {
    state.consumedSetupIds.push(setupId);
    if (state.consumedSetupIds.length > 64) state.consumedSetupIds.shift();
  }
  completion.traded = true;
};

const buildPattern = ({
  state,
  candle,
  atr,
  direction,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  direction: Direction;
  options: EngineOptions;
}): CrabPattern | null => {
  const pivots = findLatestPatternPivots(state, direction);
  if (!pivots) return null;
  const [x, a, b, c, d] = pivots;
  const sign = direction === "LONG" ? 1 : -1;
  const [xValue, aValue, bValue, cValue, dValue] = pivots.map(
    (pivot) => pivot.value * sign,
  );
  const xaHeight = aValue! - xValue!;
  const abHeight = aValue! - bValue!;
  const bcHeight = cValue! - bValue!;
  const cdHeight = cValue! - dValue!;
  const adHeight = aValue! - dValue!;

  if (
    xaHeight <= 0 ||
    abHeight <= 0 ||
    bcHeight <= 0 ||
    cdHeight <= 0 ||
    adHeight <= 0 ||
    bValue! <= xValue! ||
    cValue! <= bValue! ||
    cValue! >= aValue! ||
    dValue! >= xValue!
  ) {
    return null;
  }

  const xToABars = a.index - x.index;
  const aToBBars = b.index - a.index;
  const bToCBars = c.index - b.index;
  const cToDBars = d.index - c.index;
  if (Math.min(xToABars, aToBBars, bToCBars, cToDBars) < options.minLegBars) {
    return null;
  }

  const xbRatio = abHeight / xaHeight;
  const acRatio = bcHeight / abHeight;
  const bdRatio = cdHeight / bcHeight;
  const xdRatio = adHeight / xaHeight;
  const xdDeviationPct =
    (Math.abs(xdRatio - options.xdRatio) / options.xdRatio) * 100;
  if (
    !within(xbRatio, options.minXbRatio, options.maxXbRatio) ||
    !within(acRatio, options.minAcRatio, options.maxAcRatio) ||
    !within(bdRatio, options.minBdRatio, options.maxBdRatio) ||
    xdDeviationPct > options.xdTolerancePct
  ) {
    return null;
  }

  const intermediateXdDistances = [a, b, c].map(
    (pivot) =>
      ((pivot.value - projectLine(x, d, pivot.index)) * sign) / xaHeight,
  );
  const minIntermediateXdDistanceHeightRatio = Math.min(
    ...intermediateXdDistances,
  );
  const bXdDistanceHeightRatio = intermediateXdDistances[1]!;
  if (
    minIntermediateXdDistanceHeightRatio <= 0 ||
    bXdDistanceHeightRatio < options.minBXdDistanceHeightRatio
  ) {
    return null;
  }

  const patternAgeBars = state.currentIndex - x.index;
  const completionLagBars = state.currentIndex - d.index;
  if (
    patternAgeBars > options.maxPatternAgeBars ||
    completionLagBars > options.maxCompletionLagBars
  ) {
    return null;
  }

  const heightPct = x.value !== 0 ? (xaHeight / Math.abs(x.value)) * 100 : 0;
  const patternHeightAtr = atr != null && atr > 0 ? xaHeight / atr : 0;
  if (
    heightPct < options.minPatternHeightPct ||
    patternHeightAtr < options.minPatternHeightAtr
  ) {
    return null;
  }

  const close = asNumber(candle.close);
  if (close == null) return null;
  const kind: CrabPatternKind =
    direction === "LONG" ? "bullish_crab" : "bearish_crab";
  const setupId = `${kind}:${x.timestamp}:${a.timestamp}:${b.timestamp}:${c.timestamp}:${d.timestamp}`;
  if (hasConsumed(state, setupId)) return null;

  const pattern: CrabPattern = {
    setupId,
    kind,
    direction,
    pivots,
    targetPrice: d.value + sign * adHeight * (options.targetFibPct / 100),
    stopLossPrice: d.value - sign * xaHeight * (options.stopFibPct / 100),
    xaHeight,
    adHeight,
    patternHeightAtr,
    patternAgeBars,
    completionLagBars,
    xToABars,
    aToBBars,
    bToCBars,
    cToDBars,
    xbRatio,
    acRatio,
    bdRatio,
    xdRatio,
    xdDeviationPct,
    bXdDistanceHeightRatio,
    minIntermediateXdDistanceHeightRatio,
    timestamp: candle.timestamp,
    close,
  };
  markConsumed(state, setupId, d);
  return pattern;
};

export const buildCrabSignalContext = (pattern: CrabPattern) => ({
  setupId: pattern.setupId,
  patternKind: pattern.kind,
  signalDirection: pattern.direction,
  targetPrice: pattern.targetPrice,
  stopLossPrice: pattern.stopLossPrice,
  xaHeight: pattern.xaHeight,
  adHeight: pattern.adHeight,
  patternHeightAtr: pattern.patternHeightAtr,
  patternAgeBars: pattern.patternAgeBars,
  completionLagBars: pattern.completionLagBars,
  xToABars: pattern.xToABars,
  aToBBars: pattern.aToBBars,
  bToCBars: pattern.bToCBars,
  cToDBars: pattern.cToDBars,
  xbRatio: pattern.xbRatio,
  acRatio: pattern.acRatio,
  bdRatio: pattern.bdRatio,
  xdRatio: pattern.xdRatio,
  xdDeviationPct: pattern.xdDeviationPct,
  bXdDistanceHeightRatio: pattern.bXdDistanceHeightRatio,
  minIntermediateXdDistanceHeightRatio:
    pattern.minIntermediateXdDistanceHeightRatio,
  currentPrice: pattern.close,
  pivots: pattern.pivots.map(({ timestamp, value, kind }, index) => ({
    role: (["x", "a", "b", "c", "d"] as CrabPivotRole[])[index],
    timestamp,
    value,
    kind,
  })),
});

export type CrabSignalContext = ReturnType<typeof buildCrabSignalContext>;

export const createCrabEngine = ({
  config,
  initialCandles = [],
}: {
  config: CrabConfig;
  initialCandles?: Candle[];
}): {
  next: (candle: Candle) => CrabRuntimeState;
  getState: () => CrabRuntimeState;
} => {
  const options = getConfigNumbers(config);
  const state: EngineState = {
    records: [],
    currentIndex: -1,
    pivots: [],
    pattern: null,
    consumedSetupIds: [],
    lastTimestamp: null,
  };
  const maxRecords = Math.max(
    options.maxPatternAgeBars + options.pivotLength * 2 + 5,
    options.atrPeriod + 2,
  );

  const snapshot = (): CrabRuntimeState => ({
    pattern: state.pattern
      ? { ...state.pattern, pivots: [...state.pattern.pivots] }
      : null,
    pivots: state.pivots.map((pivot) => ({ ...pivot })),
  });

  const apply = (candle: Candle): CrabRuntimeState => {
    if (state.lastTimestamp === candle.timestamp) return snapshot();
    state.lastTimestamp = candle.timestamp;
    state.pattern = null;
    pushBoundedRecord(state, candle, maxRecords);
    detectConfirmedPivot(state, options.pivotLength);
    const atr = calculateAtr(state.records, options.atrPeriod);

    state.pattern =
      buildPattern({
        state,
        candle,
        atr,
        direction: "LONG",
        options,
      }) ??
      buildPattern({
        state,
        candle,
        atr,
        direction: "SHORT",
        options,
      });
    return snapshot();
  };

  for (const candle of initialCandles) apply(candle);
  return { next: apply, getState: snapshot };
};
