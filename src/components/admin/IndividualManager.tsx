"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLASSES, DAY_ORDER, SCHOOL_EXAMS, MOCK_EXAMS, type Student } from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  searchStudentsAction,
  updateIndividualFieldAction,
  updateRosterFieldAction,
  createStudentAction,
  deleteStudentAction,
  getSchoolExamsAction,
  upsertSchoolExamAction,
  getMockExamsAction,
  upsertMockExamAction,
} from "@/app/admin/students/individual/actions";
import { GradesEditor } from "@/components/admin/GradesEditor";

export function IndividualManager() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!name && !school && !grade) {
        setResults([]);
        return;
      }
      startTransition(async () => {
        const found = await searchStudentsAction({ name, school, grade });
        setResults(found);
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, school, grade]);

  function handleCreated(student: Student) {
    setSelected(student);
    setResults((prev) => [student, ...prev]);
    router.refresh();
  }

  function handleDeleted() {
    setSelected(null);
    setResults((prev) => prev.filter((r) => r.id !== selected?.id));
    router.refresh();
  }

  return (
    <div>
      <AddStudentForm onCreated={handleCreated} />

      <div className="mt-4 flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          placeholder="학교"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="학년"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {results.map((r) => (
          <div
            key={r.id}
            onClick={() => setSelected(r)}
            className={
              "flex cursor-pointer items-center justify-between rounded-[10px] border bg-white p-2.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)] " +
              (selected?.id === r.id ? "border-accent" : "border-line-soft")
            }
          >
            <span className="text-[13px] font-bold text-ink">{r.name}</span>
            <span className="text-xs text-ink-muted">
              {r.school ?? ""} {r.grade ? `${r.grade}학년` : ""}
            </span>
          </div>
        ))}
      </div>

      {selected && (
        <IndividualEditForm key={selected.id} student={selected} onDeleted={handleDeleted} />
      )}
    </div>
  );
}

const emptyNewStudent = {
  student_code: "",
  name: "",
  nickname: "",
  level: "고등",
  school: "",
  grade: "",
  parent_phone: "",
  student_phone: "",
  class_day: "",
  class_time: "",
  clinic_day: "",
  clinic_time: "",
};

function AddStudentForm({ onCreated }: { onCreated: (student: Student) => void }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyNewStudent);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof emptyNewStudent>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createStudentAction(form);
      if (!result.ok || !result.student) {
        setError(result.error ?? "학생을 추가하지 못했어요.");
        showToast(result.error ?? "학생을 추가하지 못했어요.", "error");
        return;
      }
      onCreated(result.student);
      setForm(emptyNewStudent);
      setOpen(false);
      showToast(`${result.student.name} 학생 추가됨`);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-[10px] border border-dashed border-ink-secondary/60 py-3 text-[13px] font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
      >
        + 학생 추가
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-2.5 text-sm font-extrabold text-ink">새 학생 추가</div>

      <div className="mb-1.5 flex gap-1.5">
        <input
          value={form.student_code}
          onChange={(e) => set("student_code", e.target.value)}
          placeholder="학번 (5자리, 필수)"
          maxLength={5}
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="이름 (필수)"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>
      <div className="mb-1.5 flex gap-1.5">
        <input
          value={form.nickname}
          onChange={(e) => set("nickname", e.target.value)}
          placeholder="닉네임"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <select
          value={form.level}
          onChange={(e) => set("level", e.target.value)}
          className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
        >
          <option value="고등">고등</option>
          <option value="중등">중등</option>
        </select>
      </div>
      <div className="mb-1.5 flex gap-1.5">
        <input
          value={form.school}
          onChange={(e) => set("school", e.target.value)}
          placeholder="학교"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={form.grade}
          onChange={(e) => set("grade", e.target.value)}
          placeholder="학년"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>
      <div className="mb-1.5 flex gap-1.5">
        <input
          value={form.parent_phone}
          onChange={(e) => set("parent_phone", e.target.value)}
          placeholder="학부모 전화번호"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={form.student_phone}
          onChange={(e) => set("student_phone", e.target.value)}
          placeholder="학생 전화번호"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>
      <div className="mb-1.5 flex gap-1.5">
        <select
          value={form.class_day}
          onChange={(e) => set("class_day", e.target.value)}
          className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
        >
          <option value="">수업요일</option>
          {DAY_ORDER.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          value={form.class_time}
          onChange={(e) => set("class_time", e.target.value)}
          placeholder="수업시간 (예: 16:00)"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>
      <div className="flex gap-1.5">
        <select
          value={form.clinic_day}
          onChange={(e) => set("clinic_day", e.target.value)}
          className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
        >
          <option value="">클리닉요일</option>
          {DAY_ORDER.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          value={form.clinic_time}
          onChange={(e) => set("clinic_time", e.target.value)}
          placeholder="클리닉시간 (예: 16:00)"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>

      {error && <div className="mt-1.5 text-[11px] font-semibold text-danger">{error}</div>}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={submit}
          disabled={pending}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50 disabled:shadow-none"
        >
          {pending ? "추가 중..." : "추가"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function IndividualEditForm({
  student,
  onDeleted,
}: {
  student: Student;
  onDeleted: () => void;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [classKey, setClassKey] = useState(student.class_key ?? CLASSES[0]);

  const [nickname, setNickname] = useState(student.nickname ?? "");
  const [school, setSchool] = useState(student.school ?? "");
  const [grade, setGrade] = useState(student.grade ?? "");
  const [level, setLevel] = useState(student.level ?? "고등");
  const [parentPhone, setParentPhone] = useState(student.parent_phone ?? "");
  const [studentPhone, setStudentPhone] = useState(student.student_phone ?? "");
  const [classDay, setClassDay] = useState(student.class_day ?? "");
  const [classTime, setClassTime] = useState(student.class_time ?? "");
  const [clinicDay, setClinicDay] = useState(student.clinic_day ?? "");
  const [clinicTime, setClinicTime] = useState(student.clinic_time ?? "");
  const [enrolled, setEnrolled] = useState(student.enrolled);
  const [deleting, setDeleting] = useState(false);

  function commitField(fields: Parameters<typeof updateIndividualFieldAction>[1]) {
    startTransition(async () => {
      await updateIndividualFieldAction(student.id, fields);
      showToast("저장됨");
    });
  }
  function commitRoster(field: string, value: string) {
    startTransition(async () => {
      await updateRosterFieldAction(student.id, field, value);
      showToast("저장됨");
    });
  }

  function remove() {
    if (!confirm(`${student.name} 학생을 삭제할까요? 출결·클리닉 기록도 함께 삭제되며 되돌릴 수 없어요.`)) {
      return;
    }
    setDeleting(true);
    startTransition(async () => {
      await deleteStudentAction(student.id);
      showToast(`${student.name} 학생 삭제됨`);
      onDeleted();
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-sm font-extrabold text-ink">{student.name} 정보 수정</div>
        <button
          onClick={remove}
          disabled={deleting}
          className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50 disabled:shadow-none"
        >
          {deleting ? "삭제 중..." : "학생 삭제"}
        </button>
      </div>

      <div className="mb-3 border-b border-line-soft pb-3">
        <div className="mb-1.5 text-[11px] font-bold text-ink-muted">기본 정보 (학번 {student.student_code})</div>
        <div className="mb-1.5 flex gap-1.5">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={(e) => commitRoster("nickname", e.target.value)}
            placeholder="닉네임"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              commitRoster("level", e.target.value);
            }}
            className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
          >
            <option value="고등">고등</option>
            <option value="중등">중등</option>
          </select>
          <button
            onClick={() => {
              const next = !enrolled;
              setEnrolled(next);
              startTransition(() => updateRosterFieldAction(student.id, "enrolled", String(next)));
            }}
            className={
              "flex-1 rounded-lg border px-2 py-2 text-xs font-bold shadow-[0_3px_14px_rgba(20,30,60,0.12)] " +
              (enrolled
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-white text-ink-secondary")
            }
          >
            {enrolled ? "재원중" : "퇴원"}
          </button>
        </div>
        <div className="mb-1.5 flex gap-1.5">
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            onBlur={(e) => commitRoster("school", e.target.value)}
            placeholder="학교"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            onBlur={(e) => commitRoster("grade", e.target.value)}
            placeholder="학년"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
        </div>
        <div className="mb-1.5 flex gap-1.5">
          <input
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            onBlur={(e) => commitRoster("parent_phone", e.target.value)}
            placeholder="학부모 전화번호"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
          <input
            value={studentPhone}
            onChange={(e) => setStudentPhone(e.target.value)}
            onBlur={(e) => commitRoster("student_phone", e.target.value)}
            placeholder="학생 전화번호"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
        </div>
        <div className="mb-1.5 flex gap-1.5">
          <select
            value={classDay}
            onChange={(e) => {
              setClassDay(e.target.value);
              commitRoster("class_day", e.target.value);
            }}
            className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
          >
            <option value="">수업요일</option>
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            value={classTime}
            onChange={(e) => setClassTime(e.target.value)}
            onBlur={(e) => commitRoster("class_time", e.target.value)}
            placeholder="수업시간 (예: 16:00)"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
        </div>
        <div className="flex gap-1.5">
          <select
            value={clinicDay}
            onChange={(e) => {
              setClinicDay(e.target.value);
              commitRoster("clinic_day", e.target.value);
            }}
            className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
          >
            <option value="">클리닉요일</option>
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            value={clinicTime}
            onChange={(e) => setClinicTime(e.target.value)}
            onBlur={(e) => commitRoster("clinic_time", e.target.value)}
            placeholder="클리닉시간 (예: 16:00)"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 text-[11px] font-bold text-ink-muted">반 배정</div>
        <select
          value={classKey}
          onChange={(e) => {
            const next = e.target.value as typeof classKey;
            setClassKey(next);
            commitField({ class_key: next });
          }}
          className="w-full box-border rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
        >
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <GradesEditor
        title="내신 성적"
        studentId={student.id}
        slots={SCHOOL_EXAMS}
        secondFieldKey="rank"
        secondFieldLabel="등수"
        fetchAction={getSchoolExamsAction}
        saveAction={upsertSchoolExamAction}
      />
      <GradesEditor
        title="모의고사 성적"
        studentId={student.id}
        slots={MOCK_EXAMS}
        secondFieldKey="percentile"
        secondFieldLabel="백분위"
        fetchAction={getMockExamsAction}
        saveAction={upsertMockExamAction}
      />
    </div>
  );
}
