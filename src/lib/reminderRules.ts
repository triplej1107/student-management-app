/**
 * "잊지마" 알림 판정 — 순수 계산만. DB·푸시는 reminder-check 라우트에 있다.
 *
 * 순수 함수로 뺀 이유는 attendanceMessages.ts와 같다 — 라우트는 "server-only"에
 * 묶여 있어서 시험에서 직접 부를 수 없다.
 */

/**
 * "1시간 전" 알림을 지금 보내야 하는지.
 *
 * 예전에는 **90분**까지 열어뒀다. 크론이 정시에 안 오는 걸 감안한 여유였는데,
 * 그 탓에 "1시간 뒤"라고 써놓고 실제로는 한 시간 반 전에 울리는 일이 있었다.
 * 이제 동기화가 5분마다 도니까 그렇게 넓힐 이유가 없다.
 *
 * 그래도 정각(60분)으로 딱 자르지는 않는다. 한 번 놓치면 그 알림은 영영
 * 안 가기 때문에, 아직 시각이 안 지났으면(diff >= 0) 늦게라도 보낸다.
 * 한 번 보내면 pushed_at이 찍혀 다시 안 간다.
 */
export const HOUR_BEFORE_WINDOW_MINUTES = 65;

export function isHourBeforeDue(
  eventTime: string,
  nowMinutes: number,
  windowMinutes = HOUR_BEFORE_WINDOW_MINUTES
): boolean {
  const m = eventTime?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const eventMinutes = Number(m[1]) * 60 + Number(m[2]);
  const diff = eventMinutes - nowMinutes;
  // 이미 지난 일정은 안 보낸다 — "1시간 뒤"라고 하면서 지난 걸 알리면 안 된다.
  return diff >= 0 && diff <= windowMinutes;
}
