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

/** "1학년 1학기 중간" → 그룹 "1학년 1학기" + 짧은 라벨 "중간"으로 나눠서
 * 탭 그리드를 학기별 행으로 묶어 보여준다(라벨 자체는 그대로 둬서 엑셀
 * 보고서 등 다른 곳에서 쓰는 전체 문구는 안 바뀐다). */
function splitLabel(label: string): { group: string; short: string } {
  const idx = label.lastIndexOf(" ");
  if (idx === -1) return { group: "", short: label };
  return { group: label.slice(0, idx), short: label.slice(idx + 1) };
}

function groupSlots<T extends { key: string; label: string }>(slots: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const s of slots) {
    const { group } = splitLabel(s.label);
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(s);
  }
  return map;
}

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
  slots: readonly { key: string; label: string; scoreless?: boolean }[];
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

  const groups = groupSlots(slots);
  const selectedSlot = slots.find((s) => s.key === selectedKey);

  return (
    <div className="mb-3 border-b border-line-soft pb-3">
      <div className="mb-1.5 text-[11px] font-bold text-ink-muted">{title}</div>
      <div className="mb-2 flex flex-col gap-1">
        {[...groups.entries()].map(([group, groupSlots]) => (
          <div key={group || "_"} className="flex items-center gap-1.5">
            {group && (
              <div className="w-[68px] flex-none shrink-0 text-[11px] text-ink-muted">{group}</div>
            )}
            <div className="flex flex-1 gap-1.5">
              {groupSlots.map((s) => {
                const filled = s.scoreless
                  ? records?.[s.key]?.[secondFieldKey] != null || records?.[s.key]?.grade != null
                  : records?.[s.key]?.score != null;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSelectedKey(s.key)}
                    className={
                      "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
                      (selectedKey === s.key
                        ? "border-accent bg-accent-soft text-accent"
                        : filled
                          ? "border-line bg-white text-ink"
                          : "border-line bg-white text-ink-muted/60")
                    }
                  >
                    {splitLabel(s.label).short}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {records === null ? (
        <div className="text-[11px] text-ink-muted/70">불러오는 중...</div>
      ) : (
        <SlotFields
          key={selectedKey}
          studentId={studentId}
          examKey={selectedKey}
          record={records[selectedKey] ?? null}
          scoreless={!!selectedSlot?.scoreless}
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
  scoreless,
  secondFieldKey,
  secondFieldLabel,
  saveAction,
  onSaved,
}: {
  studentId: number;
  examKey: string;
  record: ExamRecord | null;
  scoreless?: boolean;
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
        {!scoreless && (
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            onBlur={(e) => commit("score", e.target.value)}
            placeholder="점수"
            inputMode="decimal"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
        )}
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
