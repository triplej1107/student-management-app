"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Student } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { searchStudentsAction } from "@/app/admin/students/individual/actions";
import { grantUjcAction, getStudentUjcBalanceAction } from "@/app/admin/ujc/actions";

const PRESET_REASONS = ["오프라인 보유분 등록", "칭찬 지급", "기타"] as const;

export function UjcGrantForm() {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<(typeof PRESET_REASONS)[number]>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [pending, setPending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!name) {
        setResults([]);
        return;
      }
      startTransition(async () => {
        const found = await searchStudentsAction({ name });
        setResults(found);
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  function selectStudent(s: Student) {
    setSelected(s);
    setResults([]);
    setName(s.name);
    startTransition(async () => {
      const b = await getStudentUjcBalanceAction(s.id);
      setBalance(b);
    });
  }

  async function submit() {
    if (!selected) return;
    const n = Number(amount);
    if (!n) {
      showToast("지급할 개수를 입력해주세요", "error");
      return;
    }
    const note = reason === "기타" ? customReason.trim() : reason;
    setPending(true);
    try {
      await grantUjcAction(selected.id, n, note);
      showToast(`${selected.name} 학생에게 UJC ${n > 0 ? "+" : ""}${n}개 처리됨`);
      const b = await getStudentUjcBalanceAction(selected.id);
      setBalance(b);
      setAmount("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-2 text-sm font-bold text-ink">UJC 수동 지급</div>

      <div className="relative">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSelected(null);
            setBalance(null);
          }}
          placeholder="학생 이름 검색"
          className="w-full rounded-lg border border-line px-2.5 py-2 text-sm"
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-white shadow-lg">
            {results.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent-soft"
              >
                {s.name} <span className="text-ink-muted">· {s.class_key ?? "미배정"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-3">
          <div className="text-xs text-ink-muted">
            {selected.name} 현재 잔고 · <span className="font-bold text-ink">{balance ?? "..."}</span> UJC
          </div>

          <div className="mt-2 flex gap-1.5">
            {PRESET_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={
                  "rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
                  (reason === r
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-white text-ink-secondary")
                }
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "기타" && (
            <input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="사유를 입력하세요"
              className="mt-2 w-full rounded-lg border border-line px-2.5 py-2 text-sm"
            />
          )}

          <div className="mt-2 flex gap-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder="개수 (차감은 음수)"
              className="flex-1 rounded-lg border border-line px-2.5 py-2 text-sm"
            />
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
            >
              지급
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
