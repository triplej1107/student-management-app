import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import type { ClinicPercentilePoint } from "@/lib/types";

/** 성적 그래프 3종 — 학생 본인 화면과 종주T 개별 관리 화면이 함께 쓴다.
 * 데이터 계산은 lib/gradeTrends.ts에 있고 여기는 그리기만 한다. */
export function StudentGradeCharts({
  clinicPercentile,
  schoolPoints,
  mockPoints,
  latestTopPercent,
  compact = false,
}: {
  clinicPercentile: ClinicPercentilePoint[];
  schoolPoints: TrendPoint[];
  mockPoints: TrendPoint[];
  latestTopPercent: number | null;
  /** 종주T 개별 화면처럼 이미 설명이 많은 곳에서는 보조 설명을 줄인다. */
  compact?: boolean;
}) {
  return (
    <>
      <div className="rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-1 text-sm font-bold text-ink">클리닉 테스트 백분위 변화</div>
        {!compact && (
          <div className="mb-2 text-xs text-ink-muted">
            같은 반 안에서의 상대적 위치예요 (탭하면 정확한 등수를 볼 수 있어요)
          </div>
        )}
        {latestTopPercent !== null && (
          <div className="mb-2 text-2xl font-extrabold text-accent">현재 상위 {latestTopPercent}%</div>
        )}
        <TrendChart
          points={clinicPercentile}
          higherIsBetter={true}
          unit="%"
          yDomain={[0, 100]}
          bands={[
            { from: 90, to: 100, opacity: 0.16 },
            { from: 75, to: 90, opacity: 0.1 },
            { from: 50, to: 75, opacity: 0.05 },
          ]}
        />
        {!compact && (
          <div className="mt-2 text-[11px] leading-relaxed text-ink-muted/70">
            같은 주에 점수가 입력된 같은 반 학생들끼리 등수를 매겨요. 클리닉테스트가 여러 개면 각각의
            등수를 평균한 뒤 백분위로 환산해요.
          </div>
        )}
      </div>

      <div className="mt-3.5 rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-1 text-sm font-bold text-ink">내신 학교등수 변화</div>
        <div className="mb-2 text-xs text-ink-muted">등수는 낮을수록(위쪽일수록) 좋아요</div>
        <TrendChart points={schoolPoints} higherIsBetter={false} unit="등" />
      </div>

      <div className="mt-3.5 rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-1 text-sm font-bold text-ink">모의고사 백분위 변화</div>
        <div className="mb-2 text-xs text-ink-muted">백분위는 높을수록(위쪽일수록) 좋아요</div>
        <TrendChart points={mockPoints} higherIsBetter={true} unit="%" />
      </div>
    </>
  );
}
