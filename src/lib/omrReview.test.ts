import { describe, it, expect } from "vitest";
import { circled, wrongAnswers } from "./omrReview";

describe("wrongAnswers", () => {
  it("틀린 문항만 번호·정답·내 답으로 모은다", () => {
    expect(wrongAnswers(["1", "2", "3", "4"], ["1", "5", "3", "2"])).toEqual([
      { number: 2, correct: "2", chosen: "5" },
      { number: 4, correct: "4", chosen: "2" },
    ]);
  });

  it("다 맞으면 빈 배열", () => {
    expect(wrongAnswers(["1", "2"], ["1", "2"])).toEqual([]);
  });

  it("이탈 자동제출로 안 고른 문항('0')은 미표기로 남긴다", () => {
    expect(wrongAnswers(["3", "4"], ["0", "4"])).toEqual([
      { number: 1, correct: "3", chosen: null },
    ]);
  });

  it("답안이 정답키보다 짧아도 정답키 길이만큼 본다", () => {
    expect(wrongAnswers(["1", "2", "3"], ["1"])).toEqual([
      { number: 2, correct: "2", chosen: null },
      { number: 3, correct: "3", chosen: null },
    ]);
  });
});

describe("circled", () => {
  it("숫자를 동그라미 숫자로", () => {
    expect(circled("1")).toBe("①");
    expect(circled("5")).toBe("⑤");
  });

  it("안 고른 건 미표기", () => {
    expect(circled(null)).toBe("미표기");
  });

  it("범위 밖 값은 그대로 보여준다", () => {
    expect(circled("9")).toBe("9");
  });
});
