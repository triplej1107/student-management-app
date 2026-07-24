import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const roles = [
  { role: "student", label: "학생", style: "outline" },
  { role: "parent", label: "학부모", style: "outline" },
  { role: "staff", label: "조교", style: "accent" },
  { role: "zongju", label: "종주T", style: "dark" },
] as const;

export default async function RoleSelectPage() {
  const session = await getSession();
  if (session.role === "staff") redirect("/staff");
  if (session.role === "zongju") redirect("/admin");
  if (session.role === "student" || session.role === "parent") redirect("/student");

  return (
    <div className="flex h-full flex-1 flex-col items-center px-7 pb-5 pt-6">
      <div className="mt-2 flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-accent text-xl font-extrabold text-white">
        유
      </div>
      <div className="mt-3 text-lg font-extrabold text-ink">유종의미 국어학원</div>
      <div className="mt-1.5 text-[13px] italic text-ink-muted">
        &ldquo;국어는 오직 유종의미&rdquo;
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
      </div>
    </div>
  );
}
