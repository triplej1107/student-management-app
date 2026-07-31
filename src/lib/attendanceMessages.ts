/** 자동 출결 처리 알림 문구 — 순수 함수로 따로 빼서 DB/서버 의존성 없이
 * 테스트할 수 있게 한다(attendanceAuto.ts는 "server-only"를 임포트해서
 * 일반 Node 테스트 러너에서 직접 불러올 수 없다). */

export function buildLateMessage(effDay: string, effTime: string): string {
  return `${effDay}요일 ${effTime} 클리닉인데 아직 출석하지 않아 지각으로 처리됐어요.`;
}

export function buildAutoAbsentMessage(effDay: string, effTime: string): string {
  return `${effDay}요일 ${effTime} 클리닉, 시간 조정 없이 결석으로 처리됐어요.`;
}
