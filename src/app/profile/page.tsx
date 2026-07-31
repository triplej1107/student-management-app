import { BackButton } from "@/components/BackButton";

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18h16" />
      <path d="M4 18 3 9l5 4 4-6 4 6 5-4-1 9Z" />
    </svg>
  );
}

function ParentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" />
    </svg>
  );
}

function GraduationCapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 2 9l10 5 10-5-10-5Z" />
      <path d="M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="6" />
      <path d="M12 7.5 13.3 10.2 16.2 10.6 14.1 12.6 14.6 15.5 12 14.1 9.4 15.5 9.9 12.6 7.8 10.6 10.7 10.2 12 7.5Z" />
    </svg>
  );
}

const GUIDES = [
  { href: "/guide/parent.html", label: "학부모", Icon: ParentIcon },
  { href: "/guide/student.html", label: "학생", Icon: GraduationCapIcon },
  { href: "/guide/staff.html", label: "조교", Icon: StaffIcon },
] as const;

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

      <div className="mt-2 grid grid-cols-3 gap-2.5">
        {GUIDES.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line-soft bg-white py-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent [&>svg]:h-5 [&>svg]:w-5">
              <Icon />
            </span>
            <span className="text-[13px] font-bold text-ink">{label}</span>
            <span className="text-[10px] font-semibold text-ink-muted">앱 사용 안내서</span>
          </a>
        ))}
      </div>

      <div className="mt-3 flex items-stretch gap-2.5">
        <div className="flex-none rounded-2xl border border-line-soft bg-white p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
          <div className="mb-2 text-sm font-bold text-ink">약력</div>
          <ul className="flex flex-col gap-1.5">
            {CREDENTIALS.map((c) => (
              <li key={c} className="whitespace-nowrap text-[12px] leading-relaxed text-ink-secondary">
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

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-hover px-2 py-4 text-center text-white shadow-[0_3px_14px_rgba(20,30,60,0.15)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 [&>svg]:h-6 [&>svg]:w-6">
            <CrownIcon />
          </div>
          <div className="mt-2 text-[15px] font-extrabold">장종주T</div>
          <div className="mt-1 text-[10px] italic leading-snug text-white/80">&ldquo;배명&amp;가락<br />국어1타&rdquo;</div>
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
