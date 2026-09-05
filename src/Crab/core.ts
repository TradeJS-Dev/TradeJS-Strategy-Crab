import { round } from "@tradejs/core/math";
import {
  buildTradeEconomics,
  isStopLossOnCorrectSide,
} from "@tradejs/strategy-kit/risk";
import type {
  CreateStrategyCore,
  IndicatorsHistorySnapshot,
  Position,
} from "@tradejs/types";
import { CrabConfig } from "./config";
import { buildCrabSignalContext, createCrabEngine } from "./engine";
import { buildCrabFigures } from "./figures";

const isOpenPosition = (position: Position | null): position is Position =>
  Boolean(
    position &&
    typeof position.price === "number" &&
    Number.isFinite(position.price) &&
    typeof position.qty === "number" &&
    Number.isFinite(position.qty) &&
    position.qty > 0 &&
    (position.direction === "LONG" || position.direction === "SHORT"),
  );

const buildCrabStateKey = (config: CrabConfig) =>
  JSON.stringify({
    pivotLength: config.CRAB_PIVOT_LENGTH,
    minXbRatio: config.CRAB_MIN_XB_RATIO,
    maxXbRatio: config.CRAB_MAX_XB_RATIO,
    minAcRatio: config.CRAB_MIN_AC_RATIO,
    maxAcRatio: config.CRAB_MAX_AC_RATIO,
    minBdRatio: config.CRAB_MIN_BD_RATIO,
    maxBdRatio: config.CRAB_MAX_BD_RATIO,
    xdRatio: config.CRAB_XD_RATIO,
    xdTolerancePct: config.CRAB_XD_TOLERANCE_PCT,
    minBXdDistanceHeightRatio: config.CRAB_MIN_B_XD_DISTANCE_HEIGHT_RATIO,
    targetFibPct: config.CRAB_TARGET_FIB_PCT,
    stopFibPct: config.CRAB_STOP_FIB_PCT,
    minPatternHeightPct: config.CRAB_MIN_PATTERN_HEIGHT_PCT,
    minPatternHeightAtr: config.CRAB_MIN_PATTERN_HEIGHT_ATR,
    atrPeriod: config.CRAB_ATR_PERIOD,
    minLegBars: config.CRAB_MIN_LEG_BARS,
    maxPatternAgeBars: config.CRAB_MAX_PATTERN_AGE_BARS,
    maxCompletionLagBars: config.CRAB_MAX_COMPLETION_LAG_BARS,
  });

export const createCrabCore: CreateStrategyCore<
  CrabConfig,
  IndicatorsHistorySnapshot | undefined
> = async ({ config, data: initialData, strategyApi, indicatorsState }) => {
  const detectorState = strategyApi.createStateController<
    { engine: ReturnType<typeof createCrabEngine> },
    ReturnType<ReturnType<typeof createCrabEngine>["next"]>,
    ReturnType<ReturnType<typeof createCrabEngine>["getState"]>
  >(
    "Crab",
    () => ({
      engine: createCrabEngine({
        config,
        initialCandles: initialData,
      }),
    }),
    {
      configKey: buildCrabStateKey(config),
      snapshot: (state) => state.engine.getState(),
    },
  );
  const lastTradeController = strategyApi.createLastTradeController({
    enabled: true,
  });
  const nextDetectorState = (
    candle: Parameters<ReturnType<typeof createCrabEngine>["next"]>[0],
  ) =>
    detectorState.oncePerTimestamp(candle.timestamp, (state) =>
      state.engine.next(candle),
    );

  return async (candle) => {
    const runtimeState = nextDetectorState(candle);
    const pattern = runtimeState.pattern;
    if (!pattern) return strategyApi.skip("NO_PATTERN");

    const position = await strategyApi.getCurrentPosition();
    if (isOpenPosition(position)) {
      const oppositePattern = position.direction !== pattern.direction;
      if (Boolean(config.CRAB_EXIT_ON_OPPOSITE_PATTERN) && oppositePattern) {
        return strategyApi.exit({
          code: "CRAB_OPPOSITE_PATTERN_EXIT",
          direction: position.direction,
        });
      }
      return strategyApi.skip("POSITION_EXISTS");
    }

    if (lastTradeController.isInCooldown(candle.timestamp)) {
      return strategyApi.skip("DEV_TRADE_COOLDOWN");
    }

    const modeConfig =
      pattern.direction === "LONG" ? config.LONG : config.SHORT;
    if (!modeConfig.enable) return strategyApi.skip("STRATEGY_DISABLED");

    const { timestamp, currentPrice } =
      await strategyApi.getDecisionPriceContext();
    if (
      !isStopLossOnCorrectSide({
        direction: pattern.direction,
        currentPrice,
        stopLossPrice: pattern.stopLossPrice,
      })
    ) {
      return strategyApi.skip("INVALID_STOP");
    }

    const targetIsValid =
      pattern.direction === "LONG"
        ? pattern.targetPrice > currentPrice
        : pattern.targetPrice < currentPrice;
    if (!targetIsValid) return strategyApi.skip("TARGET_ALREADY_PASSED");

    const economics = buildTradeEconomics({
      entryPrice: currentPrice,
      stopLossPrice: pattern.stopLossPrice,
      takeProfitPrice: pattern.targetPrice,
      feeRate: Number(config.RISK_FEE_RATE ?? 0),
      slippageBps:
        Number(config.RISK_SLIPPAGE_BPS ?? 0) +
        Number(config.RISK_MARKET_IMPACT_BPS ?? 0),
    });
    const qty =
      economics.lossPerUnit > 0
        ? Number(config.MAX_LOSS_VALUE ?? 0) / economics.lossPerUnit
        : 0;
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return strategyApi.skip("INVALID_QTY");
    }

    const riskRatio = economics.netRiskRatio;
    if (riskRatio <= modeConfig.minRiskRatio) {
      return strategyApi.skip(`RISK_RATIO:${round(riskRatio)}`);
    }

    const signalContext = {
      ...buildCrabSignalContext({ ...pattern, close: currentPrice }),
      executionEconomics: {
        grossRiskRatio: economics.grossRiskRatio,
        netRiskRatio: economics.netRiskRatio,
        lossPerUnit: economics.lossPerUnit,
        rewardPerUnit: economics.rewardPerUnit,
      },
    };
    const indicators = indicatorsState.snapshot();
    lastTradeController.markTrade(timestamp);

    return strategyApi.entry({
      code:
        pattern.direction === "LONG"
          ? "CRAB_BULLISH_COMPLETION"
          : "CRAB_BEARISH_COMPLETION",
      direction: modeConfig.direction,
      indicators,
      additionalIndicators: { crabContext: signalContext },
      figures: buildCrabFigures({
        pattern,
        entryTimestamp: timestamp,
        entryPrice: currentPrice,
      }),
      orderPlan: {
        qty,
        stopLossPrice: pattern.stopLossPrice,
        takeProfits: [{ rate: 1, price: pattern.targetPrice }],
      },
    });
  };
};
