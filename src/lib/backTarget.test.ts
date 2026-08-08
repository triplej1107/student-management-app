import { describe, it, expect } from "vitest";
import { safeSearchQuery, resolveBackHref, fromQuery, studentAnchorId } from "./backTarget";

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
      // 날짜와 학생 앵커는 "어느 출결 화면의 어느 날"을 가리키는 값이라,
      // 어디로 가는지 모르는 채로 붙이면 엉뚱한 곳을 가리킨다.
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

describe("검색어를 뒤로가기 주소에 싣는다", () => {
  it("요일과 검색어를 함께 남긴다", () => {
    const href = resolveBackHref("attendance", "/x", { attendance: "/staff/attendance" }, {
      day: "수",
      q: "김민찬",
      studentId: 7,
    });
    expect(href).toBe(`/staff/attendance?day=수&q=${encodeURIComponent("김민찬")}#s7`);
  });

  it("검색어만 있어도 ?로 시작한다", () => {
    const href = resolveBackHref("attendance", "/x", { attendance: "/staff/attendance" }, {
      q: "가락고",
    });
    expect(href).toBe(`/staff/attendance?q=${encodeURIComponent("가락고")}`);
  });

  it("검색어가 없으면 아무것도 안 붙는다", () => {
    const href = resolveBackHref("attendance", "/x", { attendance: "/staff/attendance" }, {
      day: "수",
    });
    expect(href).toBe("/staff/attendance?day=수");
  });

  it("주소를 깨뜨릴 수 있는 글자는 인코딩한다", () => {
    // 사람이 친 글자라 &나 #이 들어올 수 있다. 그대로 붙이면 주소가 갈라진다.
    const href = resolveBackHref("attendance", "/x", { attendance: "/a" }, { q: "김&이#박" });
    expect(href).toBe("/a?q=%EA%B9%80%26%EC%9D%B4%23%EB%B0%95");
    expect(href.split("?")[1]).not.toContain("&");
  });

  it("터무니없이 긴 검색어는 잘라낸다", () => {
    expect(safeSearchQuery("가".repeat(200))).toHaveLength(60);
  });

  it("앞뒤 공백은 다듬는다", () => {
    expect(safeSearchQuery("  김민찬  ")).toBe("김민찬");
    expect(safeSearchQuery("   ")).toBe("");
    expect(safeSearchQuery(undefined)).toBe("");
  });

  it("주차를 바꿔도 검색어가 따라간다", () => {
    expect(fromQuery("attendance", { day: "수", q: "김" })).toBe(
      `&from=attendance&day=수&q=${encodeURIComponent("김")}`
    );
  });
});

describe("출처를 몰라도 목록 상태는 들고 간다", () => {
  it("기본 화면으로 가되 요일 탭과 검색어는 살린다", () => {
    expect(resolveBackHref(undefined, "/staff/clinic", STAFF, { day: "수", q: "김민찬" })).toBe(
      `/staff/clinic?day=수&q=${encodeURIComponent("김민찬")}`
    );
  });

  it("들고 갈 게 없으면 기본 화면 그대로", () => {
    expect(resolveBackHref(undefined, "/staff/clinic", STAFF, {})).toBe("/staff/clinic");
    expect(resolveBackHref(undefined, "/staff/clinic", STAFF)).toBe("/staff/clinic");
  });

  it("이상한 요일은 안 붙인다", () => {
    expect(resolveBackHref(undefined, "/staff/clinic", STAFF, { day: "월요일" })).toBe("/staff/clinic");
  });
});
