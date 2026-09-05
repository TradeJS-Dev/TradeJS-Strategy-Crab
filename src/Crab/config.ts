import { FEE_PERCENT as RISK_FEE_RATE } from "@tradejs/core/constants";
import {
  BacktestPriceMode,
  Direction,
  Interval,
  StrategyConfig,
} from "@tradejs/types";

export interface CrabSideConfig {
  enable: boolean;
  direction: Direction;
  minRiskRatio: number;
}

export const config = {
  ENV: "BACKTEST",
  INTERVAL: "15" as Interval,
  MAKE_ORDERS: true,
  CLOSE_OPPOSITE_POSITIONS: false,
  BACKTEST_PRICE_MODE: "open" as const,
  AI_ENABLED: false,
  AI_MODE: "llm" as const,
  ML_ENABLED: false,
  ML_THRESHOLD: 0.1,
  MIN_AI_QUALITY: 4,
  RISK_FEE_RATE,
  RISK_SLIPPAGE_BPS: 0,
  RISK_MARKET_IMPACT_BPS: 0,
  MAX_LOSS_VALUE: 10,
  MA_FAST: 14,
  MA_MEDIUM: 49,
  MA_SLOW: 50,
  OBV_SMA: 10,
  ATR: 14,
  ATR_PCT_SHORT: 7,
  ATR_PCT_LONG: 30,
  BB: 20,
  BB_STD: 2,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  CRAB_PIVOT_LENGTH: 2,
  CRAB_MIN_XB_RATIO: 0.38,
  CRAB_MAX_XB_RATIO: 0.61,
  CRAB_MIN_AC_RATIO: 0.38,
  CRAB_MAX_AC_RATIO: 0.88,
  CRAB_MIN_BD_RATIO: 2.24,
  CRAB_MAX_BD_RATIO: 4.23,
  CRAB_XD_RATIO: 1.618,
  CRAB_XD_TOLERANCE_PCT: 5,
  CRAB_MIN_B_XD_DISTANCE_HEIGHT_RATIO: 0.1,
  CRAB_TARGET_FIB_PCT: 61.8,
  CRAB_STOP_FIB_PCT: 10,
  CRAB_MIN_PATTERN_HEIGHT_PCT: 0.2,
  CRAB_MIN_PATTERN_HEIGHT_ATR: 1,
  CRAB_ATR_PERIOD: 14,
  CRAB_MIN_LEG_BARS: 1,
  CRAB_MAX_PATTERN_AGE_BARS: 240,
  CRAB_MAX_COMPLETION_LAG_BARS: 10,
  CRAB_EXIT_ON_OPPOSITE_PATTERN: true,
  LONG: {
    enable: true,
    direction: "LONG",
    minRiskRatio: 0.7,
  },
  SHORT: {
    enable: true,
    direction: "SHORT",
    minRiskRatio: 0.7,
  },
} as const;

export type CrabConfig = StrategyConfig &
  Omit<
    typeof config,
    "BACKTEST_PRICE_MODE" | "LONG" | "SHORT" | "MIN_AI_QUALITY"
  > & {
    BACKTEST_PRICE_MODE: BacktestPriceMode;
    MIN_AI_QUALITY: number;
    LONG: CrabSideConfig;
    SHORT: CrabSideConfig;
  };
