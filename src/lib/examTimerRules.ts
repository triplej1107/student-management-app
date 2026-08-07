/**
 * 모의고사 타이머 계산 — 순수 함수만. DB 조회는 examTimers.ts에 있다.
 *
 * 남은 시간을 "1초마다 하나씩 뺀 값"으로 들고 있으면 화면이 잠들거나 탭이
 * 백그라운드로 가 있는 동안 어긋난다. 그래서 항상 시작 시각과 지금 시각의
 * 차이로 다시 계산한다.
 */

/** 지금 쓰는 모의고사 시간 — 1시간 20분. 추가 창의 기본값일 뿐이라
 * 학기 중에 시험 시간이 바뀌면 입력 칸에서 그때그때 바꿔 쓰면 된다. */
export const DEFAULT_DURATION_MINUTES = 80;

/** 이만큼 남았을 때 조교에게 팝업을 띄운다. */
export const WARN_BEFORE_SECONDS = 10 * 60;
/** 남은 시간 글자가 빨개진다. */
export const RED_TEXT_SECONDS = 5 * 60;
/** 칸 전체가 빨개진다 — 이제 곧 걷어야 한다. */
export const RED_CARD_SECONDS = 60;

export interface TimerState {
  startAtISO: string;
  durationSeconds: number;
  /** 정지 중이면 그때의 남은 초. 진행 중이면 null. */
  pausedRemainingSeconds: number | null;
}

export function isPaused(t: TimerState): boolean {
  return t.pausedRemainingSeconds !== null;
}

/** 남은 초 (음수 가능 — 시간이 지난 정도를 알아야 하는 쪽이 있어서 안 자른다). */
export function remainingSeconds(t: TimerState, nowMs: number): number {
  if (t.pausedRemainingSeconds !== null) return t.pausedRemainingSeconds;
  return t.durationSeconds - (nowMs - Date.parse(t.startAtISO)) / 1000;
}

/** "44:20" — 60분이 넘어도 시간 단위로 안 끊고 분으로 쭉 센다(74:20).
 * 원장님이 보여준 표기 그대로. 끝나면 0에서 멈춘다. */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 정지 상태에서 다시 시작할 때 새 start_at.
 * 남은 시간이 그대로 이어지도록 "지금"에서 이미 흘러간 만큼을 뺀 시각으로 잡는다.
 */
export function resumeStartAtISO(t: TimerState, nowMs: number): string {
  const remaining = t.pausedRemainingSeconds ?? t.durationSeconds;
  return new Date(nowMs - (t.durationSeconds - remaining) * 1000).toISOString();
}

/**
 * KST 벽시계 "HH:MM"을 그 날짜의 실제 시각(ISO)으로.
 *
 * 서버가 UTC로 돌기 때문에 로컬 Date 생성자를 쓰면 9시간이 어긋난다.
 * KST = UTC+9이므로 UTC 기준으로는 9시간을 빼면 된다(Date.UTC가 날짜 넘김까지
 * 알아서 처리한다).
 */
export function kstTimeToISO(dateISO: string, hhmm: string): string | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  const [y, mo, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, hh - 9, mm)).toISOString();
}

/**
 * 카드 색 단계. 시간이 다가올수록 세게 — 10분 노란 칸, 5분 빨간 글자,
 * 1분 빨간 칸, 끝나면 종료.
 */
export type TimerLevel = "normal" | "warn" | "urgent" | "critical" | "done";

export function timerLevel(remaining: number): TimerLevel {
  if (remaining <= 0) return "done";
  if (remaining <= RED_CARD_SECONDS) return "critical";
  if (remaining <= RED_TEXT_SECONDS) return "urgent";
  if (remaining <= WARN_BEFORE_SECONDS) return "warn";
  return "normal";
}

function withLabel(studentName: string, examLabel: string | null): string {
  const what = examLabel?.trim() ? ` ${examLabel.trim()}` : "";
  return `${studentName} 학생${what}`;
}

/**
 * 적게 남은 사람이 앞으로 — 화면 좌측 상단부터 급한 순서로 깔린다.
 *
 * 끝난(0 이하) 타이머가 맨 앞에 온다. 시험지를 제일 먼저 걷어야 할 사람이라
 * 눈에 제일 먼저 띄어야 한다. 남은 시간이 같으면 먼저 등록한 순서를 지킨다
 * (자바스크립트 sort가 안정 정렬이라 입력 순서가 그대로 남는다).
 */
export function sortByRemaining<T>(
  timers: T[],
  nowMs: number,
  toState: (t: T) => TimerState
): T[] {
  return [...timers].sort(
    (a, b) => remainingSeconds(toState(a), nowMs) - remainingSeconds(toState(b), nowMs)
  );
}

/** 이름 대조용 정규화 — 조교가 이름칸을 직접 타이핑하기도 해서 공백 차이로
 * 어긋나지 않게 한다("이 순신" → "이순신"). */
export function normalizeStudentName(name: string): string {
  return name.replace(/\s+/g, "");
}

/**
 * 학생 화면 배너 문구 — 남은 시간대에 따라 할 일이 달라진다.
 * 남은 시간 숫자는 배너에 크게 따로 뜨므로 문구에서 분을 되풀이하지 않는다
 * (3분 남았는데 "10분 남았어요"라고 떠 있으면 안 되니까).
 */
export function studentBannerHeadline(level: TimerLevel, paused: boolean): string {
  if (paused) return "잠시 멈춤";
  switch (level) {
    case "done":
      return "시간이 끝났어요 — 마킹을 마무리하세요";
    case "critical":
    case "urgent":
      return "⏰ 곧 끝나요 — 마킹을 마무리하세요";
    case "warn":
      return "⏰ OMR 마킹을 시작하세요";
    default:
      return "시험 진행 중";
  }
}

/** 시간이 끝나고 이만큼 더 지나면 학생 화면 배너를 내린다 — 조교가 타이머를
 * 안 지우고 퇴근해도 학생 화면에 하루 종일 남아 있지 않게. */
export const STUDENT_BANNER_LINGER_SECONDS = 10 * 60;

/** 학생 화면에 이 타이머를 아직 띄울지. */
export function isBannerVisible(remaining: number): boolean {
  return remaining > -STUDENT_BANNER_LINGER_SECONDS;
}

export interface TimerStudentOption {
  id: number;
  name: string;
  code: string;
  /** "배명고 2학년" — 내신 기간에 생기는 동명이인을 가려내려고 옆에 붙인다.
   * 학교·학년이 비어 있으면 학번을 대신 보여준다. */
  detail: string;
}

/**
 * 이름 입력칸 자동완성 후보.
 *
 * 이름 일부로도, 학번으로도 찾을 수 있게 한다 — 조교가 학번을 보고 치는
 * 경우도 있어서. 이름이 그 글자로 "시작하는" 사람을 위로 올린다(김을 치면
 * 김OO이 먼저, 이름 가운데에 김이 든 사람은 뒤로).
 */
export function matchStudents(
  students: TimerStudentOption[],
  query: string,
  limit = 6
): TimerStudentOption[] {
  const q = query.trim();
  if (!q) return [];
  const hits = students.filter((s) => s.name.includes(q) || s.code.includes(q));
  // 이미 정확히 그 이름을 다 쳤으면 굳이 목록을 띄우지 않는다.
  if (hits.length === 1 && hits[0].name === q) return [];
  return hits
    .sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)))
    .slice(0, limit);
}

/** 10분 전 알림 문구 — "이순신 학생 모의고사 4회차 10분 남았습니다!" */
export function warningMessage(studentName: string, examLabel: string | null): string {
  return `${withLabel(studentName, examLabel)} 10분 남았습니다!`;
}

/** 시간이 다 됐을 때 — "이순신 학생 모의고사 4회차 시간이 끝났습니다!" */
export function finishedMessage(studentName: string, examLabel: string | null): string {
  return `${withLabel(studentName, examLabel)} 시간이 끝났습니다!`;
}
