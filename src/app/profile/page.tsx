import { BackButton } from "@/components/BackButton";

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18h16" />
      <path d="M4 18 3 9l5 4 4-6 4 6 5-4-1 9Z" />
    </svg>
  );
}

const CREDENTIALS = [
  "서울대 국어국문학과 대학원 석사 졸업",
  "중등 정교사 자격",
  "현) 유종의미 국어학원 원장",
  "현) 장박사 국어연구소 부소장",
  "전) 대치 명인학원, 대치 우리학원",
];

const PUBLICATIONS = ["우리 고전 거듭읽기", "올해의 고전시가 시리즈"];

interface ResultLine {
  label: string;
  detail: string;
}
interface ResultGroup {
  title: string;
  lines: ResultLine[];
}

// 최신순 — 가장 최근 실적이 먼저 보이도록.
const RESULTS: ResultGroup[] = [
  {
    title: "2026학년도 1학기 기말고사",
    lines: [
      { label: "배명고 3학년 언매반(9등급제)", detail: "1·2등급 합 6명 중 5명" },
      { label: "배명고 2학년(5등급제)", detail: "1등급 13명" },
      { label: "배명고 1학년(5등급제)", detail: "1등급 14명" },
      { label: "가락고 1학년", detail: "1등급 컷 74.6점 · 재원생 평균 78.5점" },
    ],
  },
  {
    title: "2026학년도 1학기 중간고사",
    lines: [
      { label: "배명고 3학년 언매반(9등급제)", detail: "1·2등급 합 6명 중 5명" },
      { label: "배명고 2학년(5등급제)", detail: "1등급 19명" },
      { label: "배명고 1학년(5등급제)", detail: "1등급 12명" },
      { label: "가락고 1학년", detail: "1등급 컷 89.2점 · 재원생 평균 88.2점" },
    ],
  },
  {
    title: "2025학년도 2학기 종합",
    lines: [
      { label: "배명고 2학년(9등급제)", detail: "1등급 9명 중 6명(유일한 100점) · 2등급 15명" },
      { label: "배명고 1학년(5등급제)", detail: "1등급 12명" },
    ],
  },
  {
    title: "2025학년도 2학기 중간고사",
    lines: [
      { label: "배명고 2학년(9등급제)", detail: "1등급 6명 · 2등급 14명" },
      { label: "배명고 1학년(5등급제)", detail: "1등급 8명" },
    ],
  },
  {
    title: "2025학년도 1학기 종합",
    lines: [
      { label: "배명고 2학년(9등급제)", detail: "1등급 10명 중 8명(6등·8등 제외 전부) · 2등급 8명" },
      { label: "배명고 1학년(5등급제)", detail: "1등급 23명 중 18명" },
    ],
  },
  {
    title: "2025학년도 1학기 중간고사",
    lines: [
      { label: "배명고 2학년(9등급제)", detail: "1등급 6명 · 2등급 15명" },
      { label: "배명고 1학년(5등급제)", detail: "1등급 9명" },
    ],
  },
];

export default function ProfilePage() {
  return (
    <div className="box-border px-5 pt-2 pb-7">
      <BackButton href="/" />

      <div className="mt-2 rounded-2xl bg-gradient-to-br from-accent to-accent-hover px-5 py-7 text-center text-white shadow-[0_3px_14px_rgba(20,30,60,0.15)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 [&>svg]:h-8 [&>svg]:w-8">
          <CrownIcon />
        </div>
        <div className="mt-3 text-xl font-extrabold">장종주T</div>
        <div className="mt-1 text-xs italic text-white/80">&ldquo;배명&amp;가락 국어1타&rdquo;</div>
      </div>

      <div className="mt-5 rounded-2xl border border-line-soft bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
        <div className="mb-2 text-sm font-bold text-ink">약력</div>
        <ul className="flex flex-col gap-1.5">
          {CREDENTIALS.map((c) => (
            <li key={c} className="text-[13px] leading-relaxed text-ink-secondary">
              · {c}
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-line-soft pt-3">
          <div className="mb-1.5 text-xs font-bold text-ink-muted">저서</div>
          <div className="flex flex-wrap gap-1.5">
            {PUBLICATIONS.map((p) => (
              <span
                key={p}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-1 text-sm font-bold text-ink">최근 학생 성과</div>
        <div className="mb-3 text-xs text-ink-muted">배명고·가락고 재원생 내신 기준</div>
        <div className="flex flex-col gap-3">
          {RESULTS.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-line-soft bg-white p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
            >
              <div className="mb-2 text-[13px] font-bold text-ink">{group.title}</div>
              <div className="flex flex-col gap-1.5">
                {group.lines.map((line) => (
                  <div key={line.label} className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-ink-muted">{line.label}</span>
                    <span className="text-right text-xs font-bold text-accent">{line.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
