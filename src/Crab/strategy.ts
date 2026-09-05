import { createCostIsolatedStrategyConfigParser } from "@tradejs/strategy-kit/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import { config as DEFAULT_CONFIG, CrabConfig } from "./config";
import { createCrabCore } from "./core";
import { crabManifest } from "./manifest";

export const CrabStrategyDefinition: ValidatedStrategyRegistryEntry<CrabConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: createCostIsolatedStrategyConfigParser({
      strategyName: "Crab",
      defaults: DEFAULT_CONFIG,
    }),
    createCore: createCrabCore,
    manifest: crabManifest,
  };
