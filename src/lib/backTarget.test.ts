import { describe, it, expect } from "vitest";
import { resolveBackHref, fromQuery } from "./backTarget";

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

  describe("날짜 들고 가기", () => {
    it("강의 출결은 보던 날짜로 돌아간다 — 안 그러면 오늘로 튄다", () => {
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF, "2026-08-22")).toBe(
        "/staff/lecture-attendance?date=2026-08-22"
      );
    });

    it("날짜가 없으면 그냥 그 화면으로", () => {
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF)).toBe("/staff/lecture-attendance");
    });

    it("YYYY-MM-DD가 아니면 붙이지 않는다 — 주소에 그대로 들어가는 값이다", () => {
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF, "어제")).toBe("/staff/lecture-attendance");
      expect(resolveBackHref("lecture", "/staff/clinic", STAFF, "2026-08-22&foo=1")).toBe(
        "/staff/lecture-attendance"
      );
    });

    it("기본 화면으로 떨어질 때는 날짜를 안 붙인다", () => {
      expect(resolveBackHref(undefined, "/staff/clinic", STAFF, "2026-08-22")).toBe("/staff/clinic");
    });
  });
});

describe("fromQuery", () => {
  it("주차를 바꿔도 출처가 따라간다", () => {
    expect(fromQuery("attendance")).toBe("&from=attendance");
  });

  it("강의 출결에서 왔으면 날짜까지 따라간다", () => {
    expect(fromQuery("lecture", "2026-08-22")).toBe("&from=lecture&date=2026-08-22");
  });

  it("모르는 출처면 아무것도 안 붙인다", () => {
    expect(fromQuery(undefined)).toBe("");
    expect(fromQuery("evil", "2026-08-22")).toBe("");
  });

  it("이상한 날짜는 빼고 출처만 붙인다", () => {
    expect(fromQuery("lecture", "몰라")).toBe("&from=lecture");
  });
});
