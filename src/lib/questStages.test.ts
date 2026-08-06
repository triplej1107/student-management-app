import { describe, it, expect } from "vitest";
import { isStaffVisible, isZongjuVisible, questStage, type QuestStage } from "./questStages";

const blank = {
  acked_at: null,
  done_at: null,
  feedback: null,
  reviewed_at: null,
  feedback_seen_at: null,
};

describe("questStage", () => {
  it("보내면 조교 확인 전", () => {
    expect(questStage(blank)).toBe("sent");
  });

  it("조교가 확인하면 하는 중", () => {
    expect(questStage({ ...blank, acked_at: "t" })).toBe("acked");
  });

  it("조교가 완료하면 종주T 차례", () => {
    expect(questStage({ ...blank, acked_at: "t", done_at: "t" })).toBe("done");
  });

  it("종주T가 피드백을 쓰면 조교에게 다시 간다", () => {
    expect(
      questStage({ ...blank, acked_at: "t", done_at: "t", reviewed_at: "t", feedback: "수고했어요" })
    ).toBe("feedback");
  });

  it("피드백 없이 확인만 눌렀으면 그대로 끝 — 조교 화면엔 아무것도 안 뜬다", () => {
    expect(questStage({ ...blank, acked_at: "t", done_at: "t", reviewed_at: "t" })).toBe("closed");
    expect(
      questStage({ ...blank, acked_at: "t", done_at: "t", reviewed_at: "t", feedback: "   " })
    ).toBe("closed");
  });

  it("조교가 피드백을 읽으면 완전히 끝", () => {
    expect(
      questStage({
        ...blank,
        acked_at: "t",
        done_at: "t",
        reviewed_at: "t",
        feedback: "수고했어요",
        feedback_seen_at: "t",
      })
    ).toBe("closed");
  });

  it("확인을 건너뛰고 완료만 눌러도 완료로 본다", () => {
    expect(questStage({ ...blank, done_at: "t" })).toBe("done");
  });
});

describe("화면별 노출", () => {
  const ALL: QuestStage[] = ["sent", "acked", "done", "feedback", "closed"];

  it("조교 홈에는 보냄·하는중·피드백만", () => {
    expect(ALL.filter(isStaffVisible)).toEqual(["sent", "acked", "feedback"]);
  });

  it("종주T 홈에는 완료만", () => {
    expect(ALL.filter(isZongjuVisible)).toEqual(["done"]);
  });
});
