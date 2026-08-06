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

/** 10분 전 알림 문구 — "이순신 학생 모의고사 4회차 10분 남았습니다!" */
export function warningMessage(studentName: string, examLabel: string | null): string {
  const what = examLabel?.trim() ? ` ${examLabel.trim()}` : "";
  return `${studentName} 학생${what} 10분 남았습니다!`;
}
