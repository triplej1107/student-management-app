import { describe, it, expect, beforeEach } from "vitest";
import { rememberQueryInUrl } from "./SearchableRoster";

/** 브라우저 없이 주소만 흉내낸다 — 실제로 확인하고 싶은 건 "어떤 주소로
 * 바뀌는가" 하나뿐이라, jsdom을 통째로 띄우지 않는다. */
let replaced: string[] = [];
function setUrl(pathname: string, search: string) {
  replaced = [];
  (globalThis as unknown as { window: unknown }).window = {
    location: { pathname, search },
    history: { replaceState: (_a: unknown, _b: unknown, url: string) => replaced.push(url) },
  };
}

describe("rememberQueryInUrl", () => {
  beforeEach(() => setUrl("/staff/attendance", ""));

  it("검색어를 주소에 남긴다", () => {
    rememberQueryInUrl("김민찬");
    expect(replaced.at(-1)).toBe(`/staff/attendance?q=${encodeURIComponent("김민찬")}`);
  });

  it("보고 있던 요일 탭은 그대로 둔다 — 검색한다고 탭이 바뀌면 안 된다", () => {
    setUrl("/staff/attendance", "?day=수");
    rememberQueryInUrl("가락고");
    expect(replaced.at(-1)).toBe(`/staff/attendance?day=%EC%88%98&q=${encodeURIComponent("가락고")}`);
  });

  it("검색어를 지우면 주소에서도 빠진다", () => {
    setUrl("/staff/attendance", "?day=수&q=김");
    rememberQueryInUrl("");
    expect(replaced.at(-1)).toBe("/staff/attendance?day=%EC%88%98");
  });

  it("남는 게 없으면 ?도 안 붙인다", () => {
    setUrl("/staff/clinic", "?q=김");
    rememberQueryInUrl("");
    expect(replaced.at(-1)).toBe("/staff/clinic");
  });

  it("이미 있던 검색어를 덮어쓴다 — 같은 칸이 두 번 붙으면 안 된다", () => {
    setUrl("/staff/clinic", "?q=김");
    rememberQueryInUrl("박");
    expect(replaced.at(-1)).toBe(`/staff/clinic?q=${encodeURIComponent("박")}`);
    expect(replaced.at(-1)!.match(/q=/g)).toHaveLength(1);
  });

  it("되돌아올 때 쓰던 앵커(#s123)는 떼어낸다 — 새 검색에는 그 학생이 없을 수 있다", () => {
    setUrl("/staff/attendance", "?day=수");
    rememberQueryInUrl("최");
    expect(replaced.at(-1)).not.toContain("#");
  });
});
