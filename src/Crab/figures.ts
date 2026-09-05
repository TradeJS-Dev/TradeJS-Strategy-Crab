import {
  StrategyEntryModelFigures,
  StrategyFigureLine,
  StrategyFigurePoints,
} from "@tradejs/types";
import { CrabPattern } from "./engine";

export const buildCrabFigures = ({
  pattern,
  entryTimestamp,
  entryPrice,
}: {
  pattern: CrabPattern;
  entryTimestamp: number;
  entryPrice: number;
}): StrategyEntryModelFigures => {
  const color = pattern.direction === "LONG" ? "#22c55e" : "#ef4444";
  const guideColor = "#a855f7";
  const [x, a, b, c, d] = pattern.pivots;
  const patternPoints = [x, a, b, c, d].map(({ timestamp, value }) => ({
    timestamp,
    value,
  }));

  const lines: StrategyFigureLine[] = [
    {
      id: `crab-pattern-${entryTimestamp}`,
      kind: `crab_${pattern.kind}_pattern`,
      points: patternPoints,
      color,
      width: 2,
      style: "solid",
    },
    {
      id: `crab-xd-${entryTimestamp}`,
      kind: "crab_xd_reference",
      points: [
        { timestamp: x.timestamp, value: x.value },
        { timestamp: d.timestamp, value: d.value },
      ],
      color: guideColor,
      width: 1,
      style: "dashed",
    },
    {
      id: `crab-xb-${entryTimestamp}`,
      kind: "crab_xb_ratio",
      points: [
        { timestamp: x.timestamp, value: x.value },
        { timestamp: b.timestamp, value: b.value },
      ],
      color: guideColor,
      width: 1,
      style: "dashed",
    },
    {
      id: `crab-ac-${entryTimestamp}`,
      kind: "crab_ac_ratio",
      points: [
        { timestamp: a.timestamp, value: a.value },
        { timestamp: c.timestamp, value: c.value },
      ],
      color: guideColor,
      width: 1,
      style: "dashed",
    },
    {
      id: `crab-bd-${entryTimestamp}`,
      kind: "crab_bd_ratio",
      points: [
        { timestamp: b.timestamp, value: b.value },
        { timestamp: d.timestamp, value: d.value },
      ],
      color: guideColor,
      width: 1,
      style: "dashed",
    },
    {
      id: `crab-target-${entryTimestamp}`,
      kind: "crab_target",
      points: [
        { timestamp: d.timestamp, value: pattern.targetPrice },
        { timestamp: entryTimestamp, value: pattern.targetPrice },
      ],
      color: "#22c55e",
      width: 1,
      style: "dashed",
    },
    {
      id: `crab-stop-${entryTimestamp}`,
      kind: "crab_stop",
      points: [
        { timestamp: d.timestamp, value: pattern.stopLossPrice },
        { timestamp: entryTimestamp, value: pattern.stopLossPrice },
      ],
      color: "#ef4444",
      width: 1,
      style: "dashed",
    },
  ];

  const points: StrategyFigurePoints[] = [
    {
      id: `crab-pivots-${entryTimestamp}`,
      kind: `crab_${pattern.kind}_pivots`,
      points: patternPoints,
      color,
      radius: 4,
    },
    {
      id: `crab-entry-${entryTimestamp}`,
      kind: "crab_entry",
      points: [{ timestamp: entryTimestamp, value: entryPrice }],
      color,
      radius: 5,
    },
  ];

  return { lines, points };
};
