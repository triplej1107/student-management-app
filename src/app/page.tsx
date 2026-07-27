import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const roles = [
  { role: "student", label: "학생", style: "outline" },
  { role: "parent", label: "학부모", style: "outline" },
  { role: "staff", label: "조교", style: "accent" },
  { role: "zongju", label: "종주T", style: "dark" },
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
      <Image
        src="/icon-192.png"
        alt="유종의미 국어학원"
        width={52}
        height={52}
        className="mt-2 rounded-2xl border border-line-soft"
        priority
      />
      <div className="mt-3 text-lg font-extrabold text-ink">유종의미 국어학원</div>
      <div className="mt-1.5 text-[13px] italic text-ink-muted">
        &ldquo;배명&amp;가락 국어1타 장종주T&rdquo;
      </div>

      <div className="mt-7 flex w-full flex-col gap-[11px]">
        {roles.map(({ role, label, style }) => (
          <Link
            key={role}
            href={`/login/${role}`}
            className={
              "flex w-full items-center justify-between rounded-2xl p-4 text-base font-bold " +
              (style === "outline"
                ? "border border-line bg-white text-ink"
                : style === "accent"
                  ? "border-none bg-accent text-white"
                  : "border-none bg-ink text-white")
            }
          >
            {label}
            <span className={style === "outline" ? "text-accent" : "text-white"}>
              ›
            </span>
          </Link>
        ))}
        <a
          href={VACATION_SCORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-between rounded-2xl border border-line bg-white p-4 text-base font-bold text-ink"
        >
          방학특강 성적조회
          <span className="text-accent">›</span>
        </a>
      </div>
    </div>
  );
}
