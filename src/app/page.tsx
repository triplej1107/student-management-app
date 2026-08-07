import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GuideNewDot } from "@/components/GuideNewDot";

function GraduationCapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 2 9l10 5 10-5-10-5Z" />
      <path d="M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5" />
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

function StaffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="6" />
      <path d="M12 7.5 13.3 10.2 16.2 10.6 14.1 12.6 14.6 15.5 12 14.1 9.4 15.5 9.9 12.6 7.8 10.6 10.7 10.2 12 7.5Z" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18h16" />
      <path d="M4 18 3 9l5 4 4-6 4 6 5-4-1 9Z" />
    </svg>
  );
}

function DictionaryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6c-1.8-1.3-4-2-6.5-2S3 4.3 3 5v13c1.5-.6 3-1 4.5-1S10.5 17.6 12 19" />
      <path d="M12 6c1.8-1.3 4-2 6.5-2S21 4.3 21 5v13c-1.5-.6-3-1-4.5-1S13.5 17.6 12 19" />
      <path d="M12 6v13" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v18h14" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5.5" width="13" height="13" rx="2.5" />
      <path d="m16 10 5-3v10l-5-3" strokeLinejoin="round" />
    </svg>
  );
}

const roles = [
  { role: "student", label: "학생", Icon: GraduationCapIcon },
  { role: "parent", label: "학부모", Icon: ParentIcon },
  { role: "staff", label: "조교", Icon: StaffIcon },
  { role: "zongju", label: "종주T", Icon: CrownIcon },
] as const;

// 임시: 여름방학 6주 특강 기간에만 노출. 방학 끝나면 이 상수와 아래 <a> 블록을 삭제.
const VACATION_SCORE_URL =
  "https://script.google.com/macros/s/AKfycbzNyUuPwkb17yz35lBrr3LCAhn2lk-e7rF07xwW7wIKRnGz7sKT5bi34WdYqyuvWs_zkQ/exec";

export default async function RoleSelectPage() {
  const session = await getSession();
  if (session.role === "staff") redirect("/staff");
  if (session.role === "zongju") redirect("/admin");
  if (session.role === "student" || session.role === "parent") redirect("/student");

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-7 pb-5 pt-6">
      {/* 로고를 누르면 프로필 → 사용 안내서. 안내서가 갱신되면 파란 점이 뜬다. */}
      <Link href="/profile" className="relative mt-2 cursor-pointer">
        <Image
          src="/icon-192.png"
          alt="유종의미 국어학원"
          width={92}
          height={92}
          className="logo-wiggle rounded-[26px] shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          priority
        />
        <GuideNewDot className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5" />
      </Link>
      <div className="mt-4 text-lg font-extrabold text-ink">유종의미 국어학원</div>
      <div className="mt-1 text-xs italic text-ink-muted">
        &ldquo;배명&amp;가락 국어1타 장종주T&rdquo;
      </div>

      <div className="mt-7 w-full">
        <div className="grid grid-cols-2 gap-[11px]">
          {roles.map(({ role, label, Icon }) => (
            <Link
              key={role}
              href={`/login/${role}`}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white py-5 text-[15px] font-bold text-ink shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent [&>svg]:h-6 [&>svg]:w-6">
                <Icon />
              </span>
              {label}
            </Link>
          ))}
        </div>

        <div className="my-4 border-t border-line" />

        <div className="flex flex-col gap-[11px]">
          <Link
            href="/dictionary"
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-base font-bold text-ink shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent [&>svg]:h-5 [&>svg]:w-5">
              <DictionaryIcon />
            </span>
            <span className="flex-1">표준국어대사전</span>
            <span className="text-accent">›</span>
          </Link>
          <a
            href={VACATION_SCORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-base font-bold text-ink shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent [&>svg]:h-5 [&>svg]:w-5">
              <ReportIcon />
            </span>
            <span className="flex-1">방학특강 성적조회</span>
            <span className="text-accent">›</span>
          </a>
          <a
            href="http://ujong.kr/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            <div className="flex w-full items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent [&>svg]:h-5 [&>svg]:w-5">
                <VideoIcon />
              </span>
              <span className="flex-1 text-base font-bold text-ink">영상강의 보러가기</span>
              <span className="text-accent">›</span>
            </div>
            <div className="mt-1.5 pl-12 text-[11px] text-ink-muted">☰ (우측 상단 메뉴) → 마이페이지 → 동영상강좌</div>
          </a>
        </div>
      </div>
    </div>
  );
}
