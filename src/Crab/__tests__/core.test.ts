/** @jest-environment node */

import { createTestStateController } from "../../testUtils/stateControllerTestUtils";
import { config as DEFAULT_CONFIG } from "../config";
import { createCrabCore } from "../core";
import { makeBullishCrabCandles } from "./engine.test";

const makeConfig = () =>
  ({
    ...DEFAULT_CONFIG,
    CRAB_PIVOT_LENGTH: 1,
    CRAB_MIN_PATTERN_HEIGHT_PCT: 0,
    CRAB_MIN_PATTERN_HEIGHT_ATR: 0,
    LONG: { ...DEFAULT_CONFIG.LONG, minRiskRatio: 0.5 },
    SHORT: { ...DEFAULT_CONFIG.SHORT, minRiskRatio: 0.5 },
  }) as any;

const mirrorCandles = (candles: ReturnType<typeof makeBullishCrabCandles>) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

const makeIndicatorsState = () =>
  ({
    setCurrentBar: jest.fn(),
    next: jest.fn(),
    onBar: jest.fn(),
    ensureInitializedWithCurrentBar: jest.fn(),
    snapshot: jest.fn(() => ({ baseContext: {} })),
    latestNumber: jest.fn(() => undefined),
    isInitialized: jest.fn(() => true),
  }) as any;

const makeStrategyApi = ({
  marketData,
  currentPosition = null,
}: {
  marketData: any;
  currentPosition?: any;
}) =>
  ({
    skip: (code: string) => ({ kind: "skip", code }),
    getDecisionPriceContext: jest.fn(async () => ({
      timestamp: marketData.timestamp,
      currentPrice: marketData.currentPrice,
      candle: marketData.lastCandle,
    })),
    getCurrentPosition: jest.fn(async () => currentPosition),
    createLastTradeController: jest.fn(() => ({
      isInCooldown: () => false,
      markTrade: jest.fn(),
      getLastTradeTimestamp: () => null,
    })),
    createStateController: createTestStateController(),
    entry: jest.fn(async (params: any) => ({
      kind: "entry",
      code: params.code,
      entryContext: {
        strategy: "Crab",
        symbol: "TESTUSDT",
        interval: "15",
        direction: params.direction,
        timestamp: marketData.timestamp,
        prices: {
          currentPrice: marketData.currentPrice,
          takeProfitPrice: params.orderPlan.takeProfits[0].price,
          stopLossPrice: params.orderPlan.stopLossPrice,
          riskRatio: 1,
        },
        isConfigFromBacktest: false,
      },
      orderPlan: params.orderPlan,
      signal: {
        signalId: "crab-test-signal",
        strategy: "Crab",
        symbol: "TESTUSDT",
        interval: "15",
        direction: params.direction,
        timestamp: marketData.timestamp,
        figures: params.figures ?? {},
        prices: {
          currentPrice: marketData.currentPrice,
          takeProfitPrice: params.orderPlan.takeProfits[0].price,
          stopLossPrice: params.orderPlan.stopLossPrice,
          riskRatio: 1,
        },
        indicators: params.indicators ?? {},
        additionalIndicators: params.additionalIndicators,
      },
    })),
    exit: jest.fn(async (params: any) => ({
      kind: "exit",
      code: params.code,
      closePlan: {
        direction: params.direction,
        price: marketData.currentPrice,
        timestamp: marketData.timestamp,
      },
    })),
  }) as any;

describe("Crab core", () => {
  it("creates a long entry with harmonic geometry on a bullish Crab", async () => {
    const candles = makeBullishCrabCandles();
    const currentCandle = candles[candles.length - 1]!;
    const marketData = {
      timestamp: currentCandle.timestamp,
      currentPrice: currentCandle.close,
      lastCandle: currentCandle,
    };
    const core = await createCrabCore({
      config: makeConfig(),
      data: candles.slice(0, -1) as any,
      strategyApi: makeStrategyApi({ marketData }),
      indicatorsState: makeIndicatorsState(),
    });

    const result = await core(currentCandle as any, currentCandle as any);

    expect(result.kind).toBe("entry");
    expect((result as any).code).toBe("CRAB_BULLISH_COMPLETION");
    expect((result as any).entryContext.direction).toBe("LONG");
    expect((result as any).signal.figures.lines).toHaveLength(7);
    expect(
      (result as any).signal.additionalIndicators.crabContext.patternKind,
    ).toBe("bullish_crab");
  });

  it("exits an existing long on a bearish Crab", async () => {
    const candles = mirrorCandles(makeBullishCrabCandles());
    const currentCandle = candles[candles.length - 1]!;
    const marketData = {
      timestamp: currentCandle.timestamp,
      currentPrice: currentCandle.close,
      lastCandle: currentCandle,
    };
    const core = await createCrabCore({
      config: makeConfig(),
      data: candles.slice(0, -1) as any,
      strategyApi: makeStrategyApi({
        marketData,
        currentPosition: { direction: "LONG", price: 110, qty: 1 },
      }),
      indicatorsState: makeIndicatorsState(),
    });

    const result = await core(currentCandle as any, currentCandle as any);
    expect(result).toMatchObject({
      kind: "exit",
      code: "CRAB_OPPOSITE_PATTERN_EXIT",
    });
  });
});
