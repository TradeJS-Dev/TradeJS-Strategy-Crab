import { StrategyManifest } from "@tradejs/types";
import { crabAiAdapter } from "./adapters/ai";

export const crabManifest: StrategyManifest = {
  name: "Crab",
  aiAdapter: crabAiAdapter,
};
