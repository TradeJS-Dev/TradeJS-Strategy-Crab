import { defineStrategyPlugin } from "@tradejs/core/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type { StrategyConfig } from "@tradejs/types";
import { config as crabDefaultConfig } from "./Crab/config";
import { CrabStrategyDefinition } from "./Crab/strategy";

export const strategyEntries: ValidatedStrategyRegistryEntry<any>[] = [
  CrabStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  Crab: crabDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export { CrabStrategyDefinition } from "./Crab/strategy";
export { crabDefaultConfig };
export { crabManifest } from "./Crab/manifest";
export { crabAiAdapter } from "./Crab/adapters/ai";

export default defineStrategyPlugin({ strategyEntries });
