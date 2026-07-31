/** 조용시간 판정 — 밤 10시(22시)부터 아침 9시까지는 알림을 보내지 않는다.
 * clinicPush.ts에서 실제로 쓰지만, "server-only"에 묶이지 않게 순수 함수로
 * 빼서 테스트할 수 있게 했다(attendanceMessages.ts와 같은 이유). */
export function isQuietHour(kstHour: number): boolean {
  return kstHour >= 22 || kstHour < 9;
}
