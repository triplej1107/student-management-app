import { describe, it, expect } from "vitest";
import { buildNotArrivedMessage, buildAutoAbsentMessage } from "./attendanceMessages";

describe("buildNotArrivedMessage", () => {
  it("안 온 것은 결석이라고 그대로 말한다", () => {
    // 예전엔 "지각으로 처리됐어요"였다. 학부모 중에 지각을 "늦었지만 왔다"로
    // 읽는 분들이 있어서, 안 온 걸 왔다고 받아들이는 일이 생겼다.
    expect(buildNotArrivedMessage("목", "15:00")).toContain("결석으로 표시했어요");
    expect(buildNotArrivedMessage("목", "15:00")).not.toContain("지각으로 처리");
  });

  it("오면 지각으로 바뀐다는 것까지 알려준다", () => {
    // 이 한 줄이 없으면 5분 늦게 도착한 학생의 학부모가 "결석 처리됐다"만 보고 놀란다.
    expect(buildNotArrivedMessage("목", "15:00")).toContain("지금이라도 오면 지각으로 바뀝니다");
  });

  it("요일과 시각을 담는다", () => {
    expect(buildNotArrivedMessage("목", "15:00")).toContain("목요일 15:00 클리닉");
  });
});

describe("buildAutoAbsentMessage", () => {
  it("emphasizes that no makeup time was arranged", () => {
    expect(buildAutoAbsentMessage("수", "20:00")).toBe(
      "수요일 20:00 클리닉, 시간 조정 없이 결석으로 처리됐어요."
    );
  });
});
