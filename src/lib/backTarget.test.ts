import { describe, it, expect } from "vitest";
import { resolveBackHref, fromQuery, studentAnchorId } from "./backTarget";

const STAFF = {
  backlog: "/staff/clinic-backlog",
  attendance: "/staff/attendance",
  lecture: "/staff/lecture-attendance",
};

describe("resolveBackHref", () => {
  it("아는 출처면 그 화면으로", () => {
    expect(resolveBackHref("attendance", "/staff/clinic", STAFF)).toBe("/staff/attendance");
    expect(resolveBackHref("lecture", "/staff/clinic", STAFF)).toBe("/staff/lecture-attendance");
  });

  it("출처가 없으면 기본 화면으로", () => {
    expect(resolveBackHref(undefined, "/staff/clinic", STAFF)).toBe("/staff/clinic");
  });

  it("모르는 출처는 무시한다 — 주소를 그대로 믿고 이동하면 외부로 튕길 수 있다", () => {
    expect(resolveBackHref("https://evil.example", "/staff/clinic", STAFF)).toBe("/staff/clinic");
    expect(resolveBackHref("//evil.example", "/staff/clinic", STAFF)).toBe("/staff/clinic");
    expect(resolveBackHref("몰라", "/staff/clinic", STAFF)).toBe("/staff/clinic");
  });

  it("그 역할에 없는 출처면 기본 화면으로", () => {
    // 종주T 화면에는 조교용 목적지가 없다.
    expect(resolveBackHref("lecture", "/admin/students/approvals", { backlog: "/admin/clinic-backlog" })).toBe(
      "/admin/students/approvals"
    );
  });

  describe("보던 날짜·요일 되살리기", () => {
    it("강의 출결은 보던 날짜로 돌아간다 — 안 그러면 오늘로 튄다", () => {
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF, { date: "2026-08-22" })).toBe(
        "/staff/lecture-attendance?date=2026-08-22"
      );
    });

    it("클리닉 출결은 보던 요일 탭으로 돌아간다", () => {
      expect(resolveBackHref("attendance", "/staff/clinic", STAFF, { day: "수" })).toBe(
        "/staff/attendance?day=수"
      );
    });

    it("아무것도 없으면 그냥 그 화면으로", () => {
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF, {})).toBe("/staff/lecture-attendance");
    });

    it("YYYY-MM-DD가 아니면 붙이지 않는다 — 주소에 그대로 들어가는 값이다", () => {
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF, { date: "어제" })).toBe(
        "/staff/lecture-attendance"
      );
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF, { date: "2026-08-22&foo=1" })).toBe(
        "/staff/lecture-attendance"
      );
    });

    it("요일이 아닌 값도 붙이지 않는다", () => {
      expect(resolveBackHref("attendance", "/staff/clinic", STAFF, { day: "everyday" })).toBe(
        "/staff/attendance"
      );
    });

    it("기본 화면으로 떨어질 때는 아무것도 안 붙인다", () => {
      expect(
        resolveBackHref(undefined, "/staff/clinic", STAFF, { date: "2026-08-22", studentId: 42 })
      ).toBe("/staff/clinic");
    });
  });

  describe("보던 학생 카드로 내려가기", () => {
    it("학생 앵커를 붙인다 — 화면 최상단에 떨어지면 다시 스크롤해야 한다", () => {
      expect(resolveBackHref("attendance", "/staff/clinic", STAFF, { studentId: 42 })).toBe(
        "/staff/attendance#s42"
      );
    });

    it("날짜와 앵커가 같이 붙는다", () => {
      expect(
        resolveBackHref("lecture", "/staff/clinic", STAFF, { date: "2026-08-22", studentId: 42 })
      ).toBe("/staff/lecture-attendance?date=2026-08-22#s42");
    });

    it("요일과 앵커가 같이 붙는다", () => {
      expect(resolveBackHref("attendance", "/staff/clinic", STAFF, { day: "수", studentId: 7 })).toBe(
        "/staff/attendance?day=수#s7"
      );
    });

    it("붙이는 쪽과 찾는 쪽이 같은 id를 쓴다", () => {
      expect(resolveBackHref("attendance", "/staff/clinic", STAFF, { studentId: 42 })).toContain(
        `#${studentAnchorId(42)}`
      );
    });

    it("학생 번호가 이상하면 앵커를 안 붙인다", () => {
      const bad = [0, -1, 1.5, NaN, undefined];
      for (const studentId of bad) {
        expect(resolveBackHref("attendance", "/staff/clinic", STAFF, { studentId })).toBe(
          "/staff/attendance"
        );
      }
    });
  });
});

describe("fromQuery", () => {
  it("주차를 바꿔도 출처가 따라간다", () => {
    expect(fromQuery("attendance")).toBe("&from=attendance");
  });

  it("강의 출결에서 왔으면 날짜까지 따라간다", () => {
    expect(fromQuery("lecture", { date: "2026-08-22" })).toBe("&from=lecture&date=2026-08-22");
  });

  it("클리닉 출결에서 왔으면 요일까지 따라간다", () => {
    expect(fromQuery("attendance", { day: "수" })).toBe("&from=attendance&day=수");
  });

  it("학생은 주소에 이미 있으니 여기 안 붙인다", () => {
    expect(fromQuery("attendance", { studentId: 42 })).toBe("&from=attendance");
  });

  it("모르는 출처면 아무것도 안 붙인다", () => {
    expect(fromQuery(undefined)).toBe("");
    expect(fromQuery("evil", { date: "2026-08-22" })).toBe("");
  });

  it("이상한 날짜·요일은 빼고 출처만 붙인다", () => {
    expect(fromQuery("lecture", { date: "몰라", day: "언제나" })).toBe("&from=lecture");
  });
});
