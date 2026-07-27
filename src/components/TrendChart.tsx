"use client";

import { useState } from "react";

export interface TrendPoint {
  label: string;
  value: number | null;
  grade: number | null;
  note: string | null;
}

const W = 320;
const H = 160;
const PAD_X = 14;
const PAD_Y = 20;

/** Simple line chart with no external deps. `higherIsBetter` controls
 * whether a larger raw value plots higher on the chart (백분위) or lower
 * (등수, where 1등이 제일 좋음). Tap a point to see its 상담 기록. */
export function TrendChart({
  points,
  higherIsBetter,
  unit,
}: {
  points: TrendPoint[];
  higherIsBetter: boolean;
  unit: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const filled = points.filter((p) => p.value !== null) as (TrendPoint & { value: number })[];
  if (filled.length === 0) {
    return <div className="py-6 text-center text-[13px] text-ink-muted/70">기록된 데이터가 없어요.</div>;
  }

  const values = filled.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const stepX = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0;

  function xFor(i: number) {
    return PAD_X + i * stepX;
  }
  function yFor(value: number) {
    const goodness = higherIsBetter ? (value - min) / (max - min) : (max - value) / (max - min);
    return PAD_Y + (1 - goodness) * (H - PAD_Y * 2);
  }

  const pathD = filled
    .map((p, i) => {
      const idx = points.indexOf(p);
      return `${i === 0 ? "M" : "L"} ${xFor(idx)} ${yFor(p.value)}`;
    })
    .join(" ");

  const selectedPoint = selected !== null ? points[selected] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_X} y2={H - PAD_Y} stroke="var(--color-line)" strokeWidth={1} />
        <path d={pathD} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
        {points.map((p, i) => {
          if (p.value === null) return null;
          const x = xFor(i);
          const y = yFor(p.value);
          const isSelected = selected === i;
          return (
            <g key={i} onClick={() => setSelected(isSelected ? null : i)} className="cursor-pointer">
              <circle cx={x} cy={y} r={10} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 5 : 3.5}
                fill={p.note ? "var(--color-accent)" : "white"}
                stroke="var(--color-accent)"
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-ink-muted">
        {points.map((p, i) => (
          <span
            key={i}
            onClick={() => (p.value !== null ? setSelected(selected === i ? null : i) : undefined)}
            className={
              "flex-1 truncate text-center " + (p.value !== null ? "cursor-pointer" : "opacity-30")
            }
          >
            {p.label}
          </span>
        ))}
      </div>
      {selectedPoint && selectedPoint.value !== null && (
        <div className="mt-2 rounded-xl bg-accent-soft p-2.5 text-xs text-ink">
          <div className="font-bold text-accent">
            {selectedPoint.label} · {selectedPoint.value}
            {unit}
            {selectedPoint.grade != null && ` · ${selectedPoint.grade}등급`}
          </div>
          {selectedPoint.note && <div className="mt-1 text-ink-secondary">{selectedPoint.note}</div>}
        </div>
      )}
    </div>
  );
}
