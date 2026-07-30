"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginFormState } from "@/app/login/actions";
import { BackButton } from "@/components/BackButton";
import type { Role } from "@/lib/types";

interface RoleMeta {
  roleLabel: string;
  idLabel?: string;
  idPlaceholder?: string;
  hasPassword: boolean;
}

export default function LoginForm({ role, meta }: { role: Role; meta: RoleMeta }) {
  const boundAction = loginAction.bind(null, role);
  const [state, formAction, pending] = useActionState<LoginFormState, FormData>(
    boundAction,
    {}
  );
  const [idValue, setIdValue] = useState("");
  const [pwValue, setPwValue] = useState("");

  const disabled =
    pending ||
    (meta.idLabel ? idValue.trim().length === 0 : false) ||
    (meta.hasPassword && pwValue.length === 0);

  return (
    <div className="box-border flex h-full flex-1 flex-col px-6 pb-5 pt-2">
      <BackButton href="/" />

      <div className="flex flex-1 flex-col justify-center">
        <div className="text-2xl font-extrabold text-ink">로그인</div>
        <div className="mt-1.5 text-[13px] text-ink-muted">
          {meta.roleLabel}(으)로 로그인합니다
        </div>

        <form action={formAction} className="mt-8 flex flex-col gap-[18px]">
          {meta.idLabel && (
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink-secondary">
                {meta.idLabel}
              </div>
              <input
                name="id"
                value={idValue}
                onChange={(e) => setIdValue(e.target.value)}
                placeholder={meta.idPlaceholder}
                className="w-full box-border rounded-xl border border-line bg-white px-4 py-3.5 text-base text-ink outline-none focus:border-accent"
              />
            </div>
          )}
          {meta.hasPassword && (
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink-secondary">
                비밀번호
              </div>
              <input
                name="password"
                type="password"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full box-border rounded-xl border border-line bg-white px-4 py-3.5 text-base text-ink outline-none focus:border-accent"
              />
            </div>
          )}

          {state.error && (
            <div className="text-[13px] font-semibold text-danger">{state.error}</div>
          )}

          <button
            type="submit"
            disabled={disabled}
            className="mt-1 w-full box-border rounded-2xl bg-accent px-4 py-4 text-base font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            {pending ? "확인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-7 text-center text-[13px] italic text-ink-muted/80">
          &ldquo;국어는 오직 유종의미&rdquo;
        </div>
      </div>
    </div>
  );
}
