"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLASSES, type ClassKey, type Student } from "@/lib/types";
import { IMPORT_COLUMNS } from "@/lib/parseRoster";
import type { BulkImportResult } from "@/lib/data";
import { useToast } from "@/components/Toast";
import {
  bulkImportAction,
  bulkDeleteAction,
  bulkSetClassKeyAction,
  bulkSetEnrolledAction,
  importAcademyWorkbookAction,
  type AcademyImportResult,
} from "@/app/admin/students/roster/actions";

function InstallBadge({ label, seenAt }: { label: string; seenAt: string | null }) {
  const seen = !!seenAt;
  return (
    <span
      title={
        seen
          ? `${label} 설치 확인됨 (${new Date(seenAt!).toLocaleDateString("ko-KR")})`
          : `${label} 설치 미확인`
      }
      className={
        "rounded-full px-1.5 py-0.5 text-[9px] font-bold " +
        (seen ? "bg-success-soft text-success" : "bg-line-soft text-ink-muted/50")
      }
    >
      {label}
    </span>
  );
}

export function RosterListManager({ students }: { students: Student[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkClassKey, setBulkClassKey] = useState<ClassKey>(CLASSES[0]);

  // Derived from the actual data (not the CLASSES constant) so old class
  // names still on students remain filterable/selectable even after the
  // constant changes (e.g. semester ↔ break class-name switches).
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) if (s.class_key) set.add(s.class_key);
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    let list = students;
    if (classFilter) list = list.filter((s) => s.class_key === classFilter);
    const q = filter.trim();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.includes(q) ||
          s.student_code.includes(q) ||
          (s.school ?? "").includes(q)
      );
    }
    return list;
  }, [students, filter, classFilter]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (filtered.every((s) => prev.has(s.id))) return new Set();
      return new Set(filtered.map((s) => s.id));
    });
  }

  function runBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}명을 삭제할까요? 출결·클리닉 기록도 함께 삭제되며 되돌릴 수 없어요.`)) {
      return;
    }
    const count = selected.size;
    startTransition(async () => {
      await bulkDeleteAction(Array.from(selected));
      setSelected(new Set());
      showToast(`${count}명 삭제됨`);
      router.refresh();
    });
  }

  function runBulkClassKey() {
    if (selected.size === 0) return;
    const count = selected.size;
    startTransition(async () => {
      await bulkSetClassKeyAction(Array.from(selected), bulkClassKey);
      setSelected(new Set());
      showToast(`${count}명 ${bulkClassKey}(으)로 반 배정됨`);
      router.refresh();
    });
  }

  function runBulkEnrolled(enrolled: boolean) {
    if (selected.size === 0) return;
    const count = selected.size;
    startTransition(async () => {
      await bulkSetEnrolledAction(Array.from(selected), enrolled);
      setSelected(new Set());
      showToast(`${count}명 ${enrolled ? "재원" : "퇴원"}(으)로 변경됨`);
      router.refresh();
    });
  }

  return (
    <div>
      <AcademyWorkbookPanel onDone={() => router.refresh()} />
      <div className="mt-2.5">
        <BulkImportPanel onDone={() => router.refresh()} />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setClassFilter(null)}
          className={
            "rounded-full border px-3 py-1.5 text-xs font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
            (classFilter === null
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-white text-ink-secondary")
          }
        >
          전체
        </button>
        {classOptions.map((c) => (
          <button
            key={c}
            onClick={() => setClassFilter(c)}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
              (classFilter === c
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-white text-ink-secondary")
            }
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="이름/학번/학교로 검색"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>

      {selected.size > 0 && (
        <div className="mt-2.5 rounded-2xl border border-accent bg-accent-soft p-3">
          <div className="mb-2 text-xs font-bold text-accent">{selected.size}명 선택됨</div>
          <div className="flex flex-wrap gap-1.5">
            <select
              value={bulkClassKey}
              onChange={(e) => setBulkClassKey(e.target.value as ClassKey)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={runBulkClassKey}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
            >
              반 배정 적용
            </button>
            <button
              onClick={() => runBulkEnrolled(true)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
            >
              재원으로 변경
            </button>
            <button
              onClick={() => runBulkEnrolled(false)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
            >
              퇴원으로 변경
            </button>
            <button
              onClick={runBulkDelete}
              className="rounded-lg border border-danger-soft bg-danger-soft px-2.5 py-1.5 text-xs font-bold text-danger shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
            >
              선택 삭제
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-b border-line-soft pb-2">
        <input
          type="checkbox"
          checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
          onChange={toggleAll}
          className="h-4 w-4"
        />
        <span className="text-xs text-ink-muted">전체 선택 ({filtered.length}명)</span>
      </div>

      <div className="flex flex-col gap-1.5 pt-2">
        {filtered.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line-soft bg-white p-2.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="h-4 w-4 flex-none"
            />
            <div className="flex-1">
              <div className="text-[13px] font-bold text-ink">
                {s.name} <span className="font-normal text-ink-muted">({s.student_code})</span>
              </div>
              <div className="text-[11px] text-ink-muted">
                {s.school ?? "-"} {s.grade ? `${s.grade}학년` : ""} · {s.class_key ?? "미배정"}
                {!s.enrolled && " · 퇴원"}
              </div>
            </div>
            <div className="flex flex-none gap-1">
              <InstallBadge label="학생" seenAt={s.student_app_seen_at} />
              <InstallBadge label="학부모" seenAt={s.parent_app_seen_at} />
            </div>
          </label>
        ))}
        {filtered.length === 0 && (
          <div className="py-6 text-center text-[13px] text-ink-muted/70">학생이 없어요.</div>
        )}
      </div>
    </div>
  );
}

/** 학원관리 프로그램에서 내려받은 "회원명단" 엑셀을 그대로 올리는 칸.
 * 열을 맞춰 붙여넣을 필요 없이 파일만 고르면 된다. */
function AcademyWorkbookPanel({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AcademyImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setResult(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const r = await importAcademyWorkbookAction(formData);
      setResult(r);
      onDone();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-[10px] border border-dashed border-accent/60 py-3 text-[13px] font-bold text-accent shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
      >
        📗 회원명단 엑셀로 학생정보 갱신
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-2 text-sm font-extrabold text-ink">회원명단 엑셀 불러오기</div>
      <div className="mb-2 text-[11px] leading-relaxed text-ink-muted">
        학원관리 프로그램에서 받은 <b>회원명단 엑셀 파일을 그대로</b> 올리면 학번을 기준으로 학생
        정보가 갱신돼요. 열을 맞추거나 붙여넣을 필요 없어요.
        <div className="mt-1.5 rounded-md bg-bg-page px-2 py-1.5">
          갱신: 이름 · 학교 · 학년 · 연락처 · 첫수업일 · 수업요일/시간(종주T 국어 수업 기준)
          <br />
          <b>건드리지 않음: 재원/퇴원 상태, 반 배정, 클리닉 일정</b>
          <br />
          엑셀에서 빈 칸인 항목은 앱에 있던 값이 그대로 남아요.
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        className="w-full text-[11px] file:mr-2 file:rounded-lg file:border file:border-line file:bg-white file:px-2.5 file:py-1.5 file:text-[11px] file:font-bold file:text-ink-secondary"
      />
      {result && (
        <div className="mt-2 text-[11px]">
          <div className="font-bold text-ink">
            신규 {result.inserted}명 · 갱신 {result.updated}명
            {result.errors.length > 0 && ` · 오류 ${result.errors.length}건`}
          </div>
          {result.noClassSchedule.length > 0 && (
            <div className="mt-1 text-warn">
              국어 수업을 못 찾아 수업요일·시간은 그대로 둔 학생: {result.noClassSchedule.join(", ")}
            </div>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-danger">
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  {e.row > 0 ? `${e.row}번째 줄: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={submit}
          disabled={pending || !fileName}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          {pending ? "불러오는 중..." : "불러오기"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function BulkImportPanel({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkImportResult | null>(null);

  function submit() {
    setResult(null);
    startTransition(async () => {
      const r = await bulkImportAction(text);
      setResult(r);
      if (r.errors.length === 0) {
        setText("");
      }
      onDone();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-[10px] border border-dashed border-ink-secondary/60 py-3 text-[13px] font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
      >
        + 학생 일괄 등록 (엑셀/시트에서 붙여넣기)
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-2 text-sm font-extrabold text-ink">학생 일괄 등록</div>
      <div className="mb-2 text-[11px] leading-relaxed text-ink-muted">
        엑셀/구글시트에서 아래 순서로 열을 맞춘 뒤, 학생 데이터를 복사해서 그대로 붙여넣으세요. 첫 줄에
        열 이름을 넣어도 자동으로 인식해서 건너뜁니다. 이미 있는 학번은 정보가 갱신되고, 새 학번은
        새로 추가됩니다.
        <div className="mt-1 rounded-md bg-bg-page px-2 py-1.5 font-mono text-[10px]">
          {IMPORT_COLUMNS.join(" | ")}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`${IMPORT_COLUMNS.join("\t")}\n95641\t권서율\t차재봉\t고등\t배명고\t2\t2010-05-12\t010-1234-5678\t010-2222-3333\t일\t13:00\t목\t15:00\t2026-03-02`}
        className="min-h-[140px] w-full box-border rounded-lg border border-line px-2.5 py-2 font-mono text-[11px]"
      />
      {result && (
        <div className="mt-2 text-[11px]">
          <div className="font-bold text-ink">
            신규 {result.inserted}명 · 갱신 {result.updated}명
            {result.errors.length > 0 && ` · 오류 ${result.errors.length}건`}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-danger">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.row > 0 ? `${e.row}번째 줄: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={submit}
          disabled={pending || !text.trim()}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          {pending ? "가져오는 중..." : "가져오기"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
