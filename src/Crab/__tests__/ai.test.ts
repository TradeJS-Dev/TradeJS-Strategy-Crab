import { crabAiAdapter } from "../adapters/ai";

describe("crabAiAdapter", () => {
  it("carries Crab geometry into the AI payload and prompt", () => {
    const context = {
      patternKind: "bullish_crab",
      signalDirection: "LONG",
      xbRatio: 0.5,
      acRatio: 0.8,
      bdRatio: 3.795,
      xdRatio: 1.618,
      pivots: [{ role: "x", value: 100 }],
    };
    const payload = crabAiAdapter.buildPayload!({
      signal: { additionalIndicators: { crabContext: context } },
      basePayload: {
        additionalIndicators: { baseContext: { available: true } },
      },
    } as any);

    expect((payload.additionalIndicators as any).crabContext).toEqual(context);
    expect((payload.additionalIndicators as any).baseContext).toEqual({
      available: true,
    });

    const prompt = crabAiAdapter.buildHumanPromptAddon!({ payload } as any);
    expect(prompt).toContain("patternKind=bullish_crab");
    expect(prompt).toContain("xbRatio=0.5");
    expect(prompt).toContain("bdRatio=3.795");
    expect(prompt).toContain("xdRatio=1.618");
  });
});
