"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui";
import { SEARCH_QUERY_KEY } from "@/lib/backTarget";

/**
 * 검색어를 **주소에 남긴다.**
 *
 * 조교가 학생을 검색해 들어갔다가 뒤로 나오면 검색창이 비어서 처음부터
 * 다시 쳐야 했다. 검색어가 이 컴포넌트 안의 임시 상태였을 뿐이라, 화면을
 * 떠나면 그냥 사라졌기 때문이다.
 *
 * 주소에 남겨두면 뒤로가기가 그 주소로 돌아오면서 검색어가 그대로 살아난다.
 * router.replace가 아니라 브라우저의 replaceState를 쓴다 — 한 글자 칠 때마다
 * 서버를 다시 부르면 명단 화면이 눈에 띄게 굼떠진다. Next 라우터도 이 방식을
 * 정식으로 지원한다(single-page-applications 문서의 "Shallow routing").
 *
 * 되돌아온 뒤 눌렀던 학생 카드로 내려가는 앵커(#s123)는 일부러 뺀다 —
 * 새로 검색을 시작한 뒤에는 가리키던 학생이 목록에 없을 수 있다.
 */
export function rememberQueryInUrl(value: string) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(SEARCH_QUERY_KEY, value);
  else params.delete(SEARCH_QUERY_KEY);
  const qs = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

export function SearchableRoster({
  items,
  placeholder,
  emptyLabel,
  /** 주소에 남아 있던 검색어. 서버가 넘겨줘서 첫 그림부터 채워진 채로 나온다
   * — 화면이 뜬 뒤에 채우면 빈 칸이 한 번 깜빡인다. */
  initialQuery = "",
}: {
  items: { key: string | number; searchText: string; node: ReactNode }[];
  placeholder: string;
  emptyLabel: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.searchText.toLowerCase().includes(q)) : items;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          rememberQueryInUrl(e.target.value);
        }}
        placeholder={placeholder}
        className="mt-3 w-full box-border rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="mt-3 flex flex-col gap-2.5">
        {filtered.length === 0 && <EmptyState>{emptyLabel}</EmptyState>}
        {filtered.map((i) => (
          <div key={i.key}>{i.node}</div>
        ))}
      </div>
    </div>
  );
}
