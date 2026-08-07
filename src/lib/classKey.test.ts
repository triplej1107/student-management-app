import { describe, it, expect, afterEach, vi } from "vitest";
import { classKeyFor, isStaleClassKey } from "./classKey";
import { classForSlot } from "./lectureRules";
import { activeClasses, SEMESTER_CLASSES, VACATION_CLASSES } from "./types";

/** 그 시각(KST 벽시계)이라고 치고 돌린다. activeClasses()가 Date.now()를 본다. */
function atKST(iso: string, hhmm = "12:00") {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T${hhmm}:00+09:00`));
}

afterEach(() => {
  vi.useRealTimers();
});

const 방학 = "2026-08-15";
const 이학기 = "2026-08-22";

describe("activeClasses", () => {
  it("8월 22일 전에는 방학 반", () => {
    atKST(방학);
    expect(activeClasses()).toEqual(VACATION_CLASSES);
  });

  it("8월 22일부터 2학기 반", () => {
    atKST(이학기);
    expect(activeClasses()).toEqual(SEMESTER_CLASSES);
  });

  it("전환은 한국 시각 자정 기준 — 21일 밤 11시는 아직 방학", () => {
    atKST("2026-08-21", "23:59");
    expect(activeClasses()).toEqual(VACATION_CLASSES);
    atKST("2026-08-22", "00:01");
    expect(activeClasses()).toEqual(SEMESTER_CLASSES);
  });
});

describe("classForSlot", () => {
  it("2학기 타임표는 타임 하나가 반 하나를 정한다", () => {
    const c = SEMESTER_CLASSES;
    expect(classForSlot("토", "09:00", c)).toBe("가락고1");
    expect(classForSlot("토", "16:00", c)).toBe("배명고1");
    expect(classForSlot("토", "19:00", c)).toBe("배명고2");
    expect(classForSlot("일", "10:00", c)).toBe("가락고1");
    expect(classForSlot("일", "13:00", c)).toBe("배명고2");
    expect(classForSlot("일", "16:00", c)).toBe("예비고1");
    expect(classForSlot("일", "19:00", c)).toBe("배명고1");
  });

  it("방학 타임표도 마찬가지", () => {
    const c = VACATION_CLASSES;
    expect(classForSlot("토", "09:00", c)).toBe("1학년정규");
    expect(classForSlot("토", "16:00", c)).toBe("1학년정규");
    expect(classForSlot("토", "19:00", c)).toBe("2학년정규");
    expect(classForSlot("일", "13:00", c)).toBe("2학년정규");
    expect(classForSlot("일", "16:00", c)).toBe("예비고1");
    expect(classForSlot("일", "19:00", c)).toBe("1학년정규");
  });

  it("토9시는 학기에 따라 다른 반이 된다 — 지금 학기 목록만 후보로 본다", () => {
    expect(classForSlot("토", "09:00", VACATION_CLASSES)).toBe("1학년정규");
    expect(classForSlot("토", "09:00", SEMESTER_CLASSES)).toBe("가락고1");
  });

  it("표에 없는 타임이면 null — 짐작으로 넘긴다", () => {
    expect(classForSlot("수", "19:00", SEMESTER_CLASSES)).toBeNull();
    expect(classForSlot("토", "10:00", SEMESTER_CLASSES)).toBeNull();
  });

  it("요일이나 시각이 비어 있으면 null", () => {
    expect(classForSlot(null, "09:00", SEMESTER_CLASSES)).toBeNull();
    expect(classForSlot("토", null, SEMESTER_CLASSES)).toBeNull();
  });
});

describe("classKeyFor", () => {
  describe("2학기", () => {
    it("타임만 있으면 학교·학년을 안 봐도 반이 나온다", () => {
      atKST(이학기);
      expect(
        classKeyFor({ level: "고등", school: null, grade: null, class_day: "일", class_time: "10:00" })
      ).toBe("가락고1");
      expect(
        classKeyFor({ level: "고등", school: null, grade: null, class_day: "토", class_time: "19:00" })
      ).toBe("배명고2");
    });

    it("타임이 학교·학년 짐작보다 우선한다 — 명단이 사실이다", () => {
      atKST(이학기);
      // 배명고 1학년인데 실제로는 가락고1 타임에 들어가 있는 경우.
      expect(
        classKeyFor({ level: "고등", school: "배명고", grade: "1", class_day: "토", class_time: "09:00" })
      ).toBe("가락고1");
    });

    it("중학생은 타임이 없어도 예비고1", () => {
      atKST(이학기);
      expect(classKeyFor({ level: "중등", school: "가락중", grade: "3", class_day: null, class_time: null })).toBe(
        "예비고1"
      );
    });

    it("타임을 모르면 학교·학년으로 짐작한다", () => {
      atKST(이학기);
      expect(classKeyFor({ level: "고등", school: "가락고", grade: "1", class_day: null, class_time: null })).toBe(
        "가락고1"
      );
      expect(classKeyFor({ level: "고등", school: "배명고", grade: "1", class_day: null, class_time: null })).toBe(
        "배명고1"
      );
      expect(classKeyFor({ level: "고등", school: "배명고", grade: "2", class_day: null, class_time: null })).toBe(
        "배명고2"
      );
    });

    it("짐작이라도 2학기에 없는 반 이름은 절대 안 나온다", () => {
      atKST(이학기);
      const guesses = [
        classKeyFor({ level: "고등", school: null, grade: null, class_day: null, class_time: null }),
        classKeyFor({ level: "고등", school: "한영외고", grade: "3", class_day: "화", class_time: "18:00" }),
      ];
      for (const g of guesses) expect(SEMESTER_CLASSES).toContain(g);
    });
  });

  describe("방학", () => {
    it("같은 타임이라도 방학에는 방학 반으로 간다", () => {
      atKST(방학);
      expect(
        classKeyFor({ level: "고등", school: "가락고", grade: "1", class_day: "토", class_time: "09:00" })
      ).toBe("1학년정규");
    });

    it("타임을 모르면 학년으로 짐작한다", () => {
      atKST(방학);
      expect(classKeyFor({ level: "고등", school: "배명고", grade: "1", class_day: null, class_time: null })).toBe(
        "1학년정규"
      );
      expect(classKeyFor({ level: "고등", school: "배명고", grade: "2", class_day: null, class_time: null })).toBe(
        "2학년정규"
      );
    });

    it("중학생은 방학에도 예비고1", () => {
      atKST(방학);
      expect(classKeyFor({ level: "중등", school: null, grade: null, class_day: null, class_time: null })).toBe(
        "예비고1"
      );
    });
  });
});

describe("isStaleClassKey", () => {
  it("2학기가 되면 방학 반 이름은 옮겨야 할 대상", () => {
    atKST(이학기);
    expect(isStaleClassKey("1학년정규")).toBe(true);
    expect(isStaleClassKey("2학년정규")).toBe(true);
  });

  it("이미 2학기 반이면 건드리지 않는다 — 종주T가 손봐둔 배정이 살아남아야 한다", () => {
    atKST(이학기);
    expect(isStaleClassKey("가락고1")).toBe(false);
    expect(isStaleClassKey("배명고1")).toBe(false);
    expect(isStaleClassKey("배명고2")).toBe(false);
  });

  it("예비고1은 두 학기 다 있어서 어느 쪽에서도 안 옮긴다", () => {
    atKST(방학);
    expect(isStaleClassKey("예비고1")).toBe(false);
    atKST(이학기);
    expect(isStaleClassKey("예비고1")).toBe(false);
  });

  it("방학 중에는 방학 반이 멀쩡하다", () => {
    atKST(방학);
    expect(isStaleClassKey("1학년정규")).toBe(false);
    expect(isStaleClassKey("가락고1")).toBe(true);
  });

  it("반이 아예 비어 있으면 새로 정해야 한다", () => {
    atKST(방학);
    expect(isStaleClassKey(null)).toBe(true);
  });
});
