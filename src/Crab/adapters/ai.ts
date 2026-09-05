import { mapAiRuntimeFromConfig } from "@tradejs/core/strategies";
import type { StrategyAiAdapter } from "@tradejs/types";
import type { CrabConfig } from "../config";

export const crabAiAdapter: StrategyAiAdapter = {
  buildPayload: ({ signal, basePayload }) => {
    const baseAdditional =
      (basePayload.additionalIndicators as
        Record<string, unknown> | undefined) ?? {};

    return {
      ...basePayload,
      additionalIndicators: {
        ...baseAdditional,
        crabContext: (
          signal.additionalIndicators as Record<string, unknown> | undefined
        )?.crabContext,
      },
    };
  },
  buildHumanPromptAddon: ({ payload }) => {
    const additional =
      (payload.additionalIndicators as Record<string, unknown> | undefined) ??
      {};
    const context =
      (additional.crabContext as Record<string, unknown> | undefined) ?? {};

    return `
Additional Crab context:
- patternKind=${String(context.patternKind ?? "n/a")}
- signalDirection=${String(context.signalDirection ?? "n/a")}
- xbRatio=${String(context.xbRatio ?? "n/a")}
- acRatio=${String(context.acRatio ?? "n/a")}
- bdRatio=${String(context.bdRatio ?? "n/a")}
- xdRatio=${String(context.xdRatio ?? "n/a")}
- xdDeviationPct=${String(context.xdDeviationPct ?? "n/a")}
- bXdDistanceHeightRatio=${String(context.bXdDistanceHeightRatio ?? "n/a")}
- completionLagBars=${String(context.completionLagBars ?? "n/a")}
- targetPrice=${String(context.targetPrice ?? "n/a")}
- stopLossPrice=${String(context.stopLossPrice ?? "n/a")}
- pivots=${JSON.stringify(context.pivots ?? [])}

Interpretation rules for Crab:
- A bullish Crab is low X, high A, low B, high C and a lower D below X; it points to a LONG reversal from D.
- A bearish Crab is the exact mirror image and points to a SHORT reversal from D.
- XB means AB/XA, AC means BC/AB, BD means CD/BC and XD means AD/XA in the ratio fields.
- X-D is a geometry reference: A, B and C must stay on the inner side of that line, with B clearly separated from it.
- The ratios validate one completed pattern and are not independent entry signals.
- Reject analysis that contradicts the signal direction or ignores invalidation beyond D.
`.trim();
  },
  mapEntryRuntimeFromConfig: (config) =>
    mapAiRuntimeFromConfig(
      config as Pick<CrabConfig, "AI_ENABLED" | "AI_MODE" | "MIN_AI_QUALITY">,
    ),
};
