import "server-only";
import type { MacgaiCheckIn } from "./lectureAttendance";

/**
 * 맥가이7(edu.macgai7.com) 등하원명단 읽어오기 — **아직 안 만들어졌다.**
 *
 * 이 파일 하나만 채우면 강의 출결 자동화가 돈다. 판정·기록·알림·감시는
 * 전부 lectureAttendance.ts에 이미 있고, 여기서 넘겨주는 것은
 * `{ studentCode, checkedInTime }` 배열뿐이다.
 *
 * 만드는 방법은 `docs/맥가이7-연동-작업지시.md` 참고. 먼저 조사 도구부터
 * 돌리면 아래 1~3을 손으로 알아낼 필요가 없다:
 *
 *     MACGAI7_ID=... MACGAI7_PASSWORD=... npm run macgai:probe
 *
 * 요약하면:
 *
 * 1. MACGAI7_ID / MACGAI7_PASSWORD로 로그인해 세션 쿠키를 받는다.
 *    (.aspx 기반이라 __VIEWSTATE 등 숨은 필드를 같이 넘겨야 할 수 있다)
 * 2. 출결관리 > 출결현황 > 등하원명단을 오늘 날짜로 조회한다.
 *    화면 HTML을 파싱하기보다 **엑셀 버튼이 부르는 요청**을 그대로 쓰는 편이
 *    낫다 — 마크업보다 잘 안 바뀐다.
 * 3. "학번" 칸과 "등원" 칸만 뽑는다.
 *
 * ⚠️ 이름·학급·**전화번호는 가져오지 말 것.** 앱에 저장할 이유가 없고,
 * 지나가기만 해도 사고 위험만 는다.
 */
export async function fetchTodayCheckIns(): Promise<MacgaiCheckIn[]> {
  throw new Error(
    "맥가이7 연동이 아직 구현되지 않았습니다. docs/맥가이7-연동-작업지시.md를 보고 fetchTodayCheckIns를 채워주세요."
  );
}

/** 연동이 준비됐는지 — 크론이 헛돌지 않게 미리 확인한다. */
export function isMacgaiConfigured(): boolean {
  return !!process.env.MACGAI7_ID && !!process.env.MACGAI7_PASSWORD;
}
