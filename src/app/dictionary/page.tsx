import Link from "next/link";
import { searchDictionary } from "@/lib/dictionary";
import { EmptyState } from "@/components/ui";

export default async function DictionaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchDictionary(query) : [];

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <Link href="/" className="inline-block px-0 py-1.5 text-[22px] leading-none text-ink">
        ‹
      </Link>
      <div className="border-b border-line pb-3 pt-1 text-center">
        <div className="text-[19px] font-extrabold text-ink">표준국어대사전</div>
        <div className="mt-1 text-xs italic text-ink-muted">국립국어원</div>
      </div>

      <form method="get" className="mt-4 flex gap-1.5">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="단어를 입력하세요"
          autoFocus
          className="flex-1 box-border rounded-xl border border-line bg-white px-4 py-3 text-base text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white"
        >
          검색
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3">
        {query && results.length === 0 && <EmptyState>&ldquo;{query}&rdquo;에 대한 검색 결과가 없어요.</EmptyState>}
        {results.map((r, i) => (
          <div key={i} className="rounded-2xl border border-line-soft bg-white p-3.5">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-[16px] font-bold text-ink">{r.word}</span>
              {r.origin && <span className="text-xs text-ink-muted">({r.origin})</span>}
            </div>

            {r.posGroups.length === 0 && (
              <div className="mt-1 text-[13px] text-ink-muted/70">뜻풀이를 불러오지 못했어요.</div>
            )}

            {r.posGroups.map((group, gi) => (
              <div key={gi} className={gi > 0 ? "mt-3" : "mt-2"}>
                <div className="text-xs font-bold text-accent">{group.pos}</div>
                <ol className="mt-1 flex flex-col gap-2">
                  {group.senses.map((sense, si) => (
                    <li key={si} className="text-[13px] leading-relaxed text-ink-secondary">
                      <span className="font-semibold text-ink">{si + 1}. </span>
                      {sense.definition}
                      {sense.examples.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5 pl-4">
                          {sense.examples.map((ex, ei) => (
                            <li key={ei} className="text-xs italic text-ink-muted">
                              · {ex}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
