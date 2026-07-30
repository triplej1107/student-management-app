"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DAY_ORDER, type Staff } from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  updateStaffFieldAction,
  toggleStaffWorkDayAction,
  setStaffPasswordAction,
  deleteStaffAction,
} from "@/app/admin/staff/profiles/actions";

export function StaffProfileCard({ staff }: { staff: Staff }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(staff.name);
  const [username, setUsername] = useState(staff.username);
  const [workTime, setWorkTime] = useState(staff.work_time ?? "");
  const [workPeriod, setWorkPeriod] = useState(staff.work_period ?? "");
  const [note, setNote] = useState(staff.note ?? "");
  const [newPassword, setNewPassword] = useState("");

  function commit(field: "name" | "username" | "work_time" | "work_period" | "note", value: string) {
    startTransition(async () => {
      await updateStaffFieldAction(staff.id, field, value);
      showToast("저장됨");
      router.refresh();
    });
  }

  function toggleDay(day: string) {
    startTransition(async () => {
      await toggleStaffWorkDayAction(staff.id, day);
      showToast("저장됨");
      router.refresh();
    });
  }

  function savePassword() {
    if (!newPassword.trim()) return;
    startTransition(async () => {
      await setStaffPasswordAction(staff.id, newPassword);
      setNewPassword("");
      showToast("비밀번호 변경됨");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteStaffAction(staff.id);
      showToast("조교 삭제됨");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-2 flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => commit("name", e.target.value)}
          placeholder="이름"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-[13px] font-bold"
        />
        <button
          onClick={remove}
          className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs font-bold text-danger shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          삭제
        </button>
      </div>

      <div className="mb-1.5 text-[11px] font-bold text-ink-muted">출근 요일</div>
      <div className="mb-2 flex flex-wrap gap-1">
        {DAY_ORDER.map((d) => (
          <button
            key={d}
            onClick={() => toggleDay(d)}
            className={
              "rounded-[7px] border px-2.5 py-1.5 text-[11px] font-bold shadow-[0_3px_14px_rgba(20,30,60,0.12)] " +
              (staff.work_days.includes(d)
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-white text-ink-secondary")
            }
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mb-1.5 flex gap-1.5">
        <input
          value={workTime}
          onChange={(e) => setWorkTime(e.target.value)}
          onBlur={(e) => commit("work_time", e.target.value)}
          placeholder="출근 시간 (예: 16:00)"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={workPeriod}
          onChange={(e) => setWorkPeriod(e.target.value)}
          onBlur={(e) => commit("work_period", e.target.value)}
          placeholder="근무기간 (예: 2025.03~)"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={(e) => commit("note", e.target.value)}
        placeholder="특이사항"
        className="mb-1.5 min-h-[44px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-xs"
      />

      <div className="flex gap-1.5">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={(e) => commit("username", e.target.value)}
          placeholder="아이디 부여"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          onBlur={savePassword}
          placeholder="새 비밀번호 설정"
          type="password"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>
    </div>
  );
}
