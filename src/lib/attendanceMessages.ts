/** 자동 출결 처리 알림 문구 — 순수 함수로 따로 빼서 DB/서버 의존성 없이
 * 테스트할 수 있게 한다(attendanceAuto.ts는 "server-only"를 임포트해서
 * 일반 Node 테스트 러너에서 직접 불러올 수 없다). */

/**
 * 시각이 지나도록 안 온 학생 — **결석**으로 알린다.
 *
 * 예전에는 이 자리에서 "지각"으로 알렸는데, 학부모 중에 지각을 "늦었지만
 * 왔다"로 읽는 분들이 있어서 안 온 걸 왔다고 받아들이는 일이 생겼다.
 * 안 온 건 결석이라고 그대로 말하고, 뒤에 오면 지각으로 바꾼다.
 *
 * 뒤에 바뀐다는 것을 문구에 꼭 남긴다 — 안 그러면 5분 늦게 도착한 학생의
 * 학부모가 "결석 처리됐다"만 보고 놀란다.
 */
export function buildNotArrivedMessage(effDay: string, effTime: string): string {
  return `${effDay}요일 ${effTime} 클리닉인데 아직 출석하지 않아 결석으로 표시했어요. 지금이라도 오면 지각으로 바뀝니다.`;
}

export function buildAutoAbsentMessage(effDay: string, effTime: string): string {
  return `${effDay}요일 ${effTime} 클리닉, 시간 조정 없이 결석으로 처리됐어요.`;
}
