import { describe, it, expect } from "vitest";
import {
  GRADE_AMOUNT,
  GRADE_TOP_AMOUNT,
  gradeScholarshipAmount,
  parseReferrerName,
  referralDueFromISO,
  referralState,
} from "./scholarshipRules";

describe("parseReferrerName", () => {
  it("'OOO 소개' 한 줄에서 이름을 뽑는다", () => {
    expect(parseReferrerName("이승훈 소개")).toBe("이승훈");
  });

  it("뒤에 다른 메모가 붙어 있어도 이름만 뽑는다", () => {
    expect(parseReferrerName("반규현 소개\n공부 의욕이 많다.")).toBe("반규현");
    expect(parseReferrerName("이재호 소개\n(통화내역 확인)\n\n영상 보내주기")).toBe("이재호");
  });

  it("붙여 쓴 경우도 읽는다", () => {
    expect(parseReferrerName("송희우소개")).toBe("송희우");
  });

  it("이름 뒤에 '학생'이 붙어도 이름만 남긴다", () => {
    // 이걸 놓치면 "주환학생"이 통째로 이름이 되어 명단에서 못 찾는다.
    expect(parseReferrerName("주환학생 소개 할인 (4월분 적용)")).toBe("주환");
    expect(parseReferrerName("김주환 학생 소개")).toBe("김주환");
  });

  it("소개와 무관한 메모는 걸리지 않는다", () => {
    expect(parseReferrerName("여름 특강 수강")).toBeNull();
    expect(parseReferrerName("느린학습자")).toBeNull();
    expect(parseReferrerName("-")).toBeNull();
    expect(parseReferrerName("")).toBeNull();
    expect(parseReferrerName(null)).toBeNull();
  });
});

describe("referralDueFromISO", () => {
  it("첫수업 다음 달 1일이 지급 가능일", () => {
    expect(referralDueFromISO("2026-08-10")).toBe("2026-09-01");
    expect(referralDueFromISO("2026-08-31")).toBe("2026-09-01");
  });

  it("12월 첫수업은 다음 해 1월로 넘어간다", () => {
    expect(referralDueFromISO("2026-12-05")).toBe("2027-01-01");
  });
});

describe("referralState", () => {
  const base = {
    paid: false,
    hasReferrer: true,
    firstLessonISO: "2026-08-10",
    withdrawnAtISO: null as string | null,
    todayISO: "2026-08-20",
  };

  it("둘째 달이 되기 전이면 대기", () => {
    expect(referralState(base)).toBe("waiting");
  });

  it("둘째 달이 시작되면 지급 대상", () => {
    expect(referralState({ ...base, todayISO: "2026-09-01" })).toBe("due");
    expect(referralState({ ...base, todayISO: "2026-09-15" })).toBe("due");
  });

  it("이미 줬으면 지급 완료", () => {
    expect(referralState({ ...base, paid: true, todayISO: "2026-09-15" })).toBe("paid");
  });

  it("두 달을 못 채우고 퇴원하면 무효", () => {
    expect(
      referralState({ ...base, withdrawnAtISO: "2026-08-25T10:00:00Z", todayISO: "2026-09-15" })
    ).toBe("void");
  });

  it("지급일이 지난 뒤 퇴원한 건 그대로 지급 대상", () => {
    expect(
      referralState({ ...base, withdrawnAtISO: "2026-09-05T10:00:00Z", todayISO: "2026-09-15" })
    ).toBe("due");
  });

  it("소개자를 못 찾았거나 첫수업일이 없으면 확인 필요", () => {
    expect(referralState({ ...base, hasReferrer: false })).toBe("unknown");
    expect(referralState({ ...base, firstLessonISO: null })).toBe("unknown");
  });

  it("확인 필요 상태라도 이미 줬으면 지급 완료가 이긴다", () => {
    expect(referralState({ ...base, hasReferrer: false, paid: true })).toBe("paid");
  });
});

describe("gradeScholarshipAmount", () => {
  it("전교 3등 이내는 5만원", () => {
    expect(gradeScholarshipAmount(1)).toBe(GRADE_TOP_AMOUNT);
    expect(gradeScholarshipAmount(3)).toBe(GRADE_TOP_AMOUNT);
  });

  it("그 밖의 1등급은 3만원", () => {
    expect(gradeScholarshipAmount(4)).toBe(GRADE_AMOUNT);
    expect(gradeScholarshipAmount(20)).toBe(GRADE_AMOUNT);
  });

  it("등수를 안 적었으면 기본 3만원", () => {
    expect(gradeScholarshipAmount(null)).toBe(GRADE_AMOUNT);
  });
});
