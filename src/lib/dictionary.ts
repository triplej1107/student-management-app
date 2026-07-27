import "server-only";

export interface DictionaryEntry {
  word: string;
  pos: string | null;
  origin: string | null;
  definition: string;
  link: string;
}

interface StdictSense {
  definition?: string;
  link?: string;
  type?: string;
}

interface StdictItem {
  word: string;
  pos?: string;
  origin?: string;
  sense?: StdictSense | StdictSense[];
}

/** Searches the 국립국어원 표준국어대사전 Open API. Each result is one
 * headword entry with its primary sense — the search endpoint doesn't
 * return every sub-meaning (that needs the separate view.do detail call). */
export async function searchDictionary(query: string): Promise<DictionaryEntry[]> {
  const key = process.env.STDICT_API_KEY;
  const q = query.trim();
  if (!key || !q) return [];

  const params = new URLSearchParams({
    key,
    q,
    req_type: "json",
    num: "20",
  });

  const res = await fetch(`https://stdict.korean.go.kr/api/search.do?${params}`, {
    cache: "no-store",
  });
  const text = await res.text();
  if (!text.trim()) return [];

  let data: { channel?: { item?: StdictItem | StdictItem[] } };
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  const raw = data.channel?.item;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];

  return items.map((item) => {
    const sense = Array.isArray(item.sense) ? item.sense[0] : item.sense;
    return {
      word: item.word,
      pos: item.pos?.trim() || null,
      origin: item.origin?.trim() || null,
      definition: sense?.definition ?? "",
      link: sense?.link ?? "",
    };
  });
}
