import { requireZongjuSession } from "@/lib/authz";
import { logoutAction } from "@/app/login/actions";
import { AdminTopNav } from "@/components/admin/AdminTopNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireZongjuSession();

  return (
    <div className="box-border flex-1 px-5 pt-2 pb-7">
      <div className="flex items-center justify-between">
        <div className="text-xl font-extrabold text-ink">종주T</div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm text-ink-secondary"
            aria-label="로그아웃"
          >
            ↩
          </button>
        </form>
      </div>

      <AdminTopNav />

      {children}
    </div>
  );
}
