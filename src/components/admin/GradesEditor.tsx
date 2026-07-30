"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";

interface ExamRecord {
  score: number | null;
  grade: number | null;
  note: string | null;
  rank?: number | null;
  percentile?: number | null;
}

type ExamFields = Partial<{ score: number | null; grade: number | null; note: string | null }> &
  Record<string, number | string | null | undefined>;

export function GradesEditor({
  title,
  studentId,
  slots,
  secondFieldKey,
  secondFieldLabel,
  fetchAction,
  saveAction,
}: {
  title: string;
  studentId: number;
  slots: readonly { key: string; label: string }[];
  secondFieldKey: "rank" | "percentile";
  secondFieldLabel: string;
  fetchAction: (studentId: number) => Promise<Record<string, ExamRecord>>;
  saveAction: (studentId: number, examKey: string, fields: ExamFields) => Promise<void>;
}) {
  const [records, setRecords] = useState<Record<string, ExamRecord> | null>(null);
  const [selectedKey, setSelectedKey] = useState(slots[0].key);

  useEffect(() => {
    let cancelled = false;
    fetchAction(studentId).then((data) => {
      if (!cancelled) setRecords(data);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, fetchAction]);

  function handleSaved(examKey: string, fields: ExamFields) {
    setRecords((prev) => ({
      ...prev,
      [examKey]: {
        score: null,
        grade: null,
        note: null,
        ...(prev?.[examKey] ?? {}),
        ...fields,
      } as ExamRecord,
    }));
  }

  return (
    <div className="mb-3 border-b border-line-soft pb-3">
      <div className="mb-1.5 text-[11px] font-bold text-ink-muted">{title}</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {slots.map((s) => {
          const filled = records?.[s.key]?.score != null;
          return (
            <button
              key={s.key}
              onClick={() => setSelectedKey(s.key)}
              className={
                "rounded-lg border px-2 py-1.5 text-[11px] font-bold shadow-[0_3px_14px_rgba(20,30,60,0.12)] " +
                (selectedKey === s.key
                  ? "border-accent bg-accent-soft text-accent"
                  : filled
                    ? "border-line bg-white text-ink"
                    : "border-line bg-white text-ink-muted/60")
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {records === null ? (
        <div className="text-[11px] text-ink-muted/70">불러오는 중...</div>
      ) : (
        <SlotFields
          key={selectedKey}
          studentId={studentId}
          examKey={selectedKey}
          record={records[selectedKey] ?? null}
          secondFieldKey={secondFieldKey}
          secondFieldLabel={secondFieldLabel}
          saveAction={saveAction}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function SlotFields({
  studentId,
  examKey,
  record,
  secondFieldKey,
  secondFieldLabel,
  saveAction,
  onSaved,
}: {
  studentId: number;
  examKey: string;
  record: ExamRecord | null;
  secondFieldKey: "rank" | "percentile";
  secondFieldLabel: string;
  saveAction: (studentId: number, examKey: string, fields: ExamFields) => Promise<void>;
  onSaved: (examKey: string, fields: ExamFields) => void;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [score, setScore] = useState(record?.score?.toString() ?? "");
  const [second, setSecond] = useState(record?.[secondFieldKey]?.toString() ?? "");
  const [grade, setGrade] = useState(record?.grade?.toString() ?? "");
  const [note, setNote] = useState(record?.note ?? "");

  function commit(field: "score" | "rank" | "percentile" | "grade" | "note", value: string) {
    const fields: ExamFields =
      field === "note"
        ? { note: value.trim() || null }
        : { [field]: value.trim() === "" ? null : Number(value) };
    startTransition(async () => {
      await saveAction(studentId, examKey, fields);
      onSaved(examKey, fields);
      showToast("저장됨");
    });
  }

  return (
    <>
      <div className="flex gap-1.5">
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          onBlur={(e) => commit("score", e.target.value)}
          placeholder="점수"
          inputMode="decimal"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={second}
          onChange={(e) => setSecond(e.target.value)}
          onBlur={(e) => commit(secondFieldKey, e.target.value)}
          placeholder={secondFieldLabel}
          inputMode="decimal"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          onBlur={(e) => commit("grade", e.target.value)}
          placeholder="등급"
          inputMode="numeric"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={(e) => commit("note", e.target.value)}
        placeholder="상담 기록 (선택)"
        className="mt-1.5 min-h-[44px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-xs"
      />
    </>
  );
}
