import "server-only";
import { XMLParser } from "fast-xml-parser";

export interface DictionarySense {
  definition: string;
  examples: string[];
}

export interface DictionaryPosGroup {
  pos: string;
  senses: DictionarySense[];
}

export interface DictionaryEntry {
  word: string;
  origin: string | null;
  posGroups: DictionaryPosGroup[];
  link: string;
}

interface StdictSearchSense {
  link?: string;
}

interface StdictSearchItem {
  word: string;
  target_code: string;
  origin?: string;
  sense?: StdictSearchSense | StdictSearchSense[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => ["item", "pos_info", "comm_pattern_info", "sense_info", "example_info"].includes(name),
});

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

/** view.do로 표제어(target_code) 하나의 전체 뜻풀이를 가져온다 — 품사별로
 * 여러 의미 항목(sense_info)이 있고, 의미마다 예문(example_info)이
 * 여러 개 딸려 있다. search.do는 첫 번째 뜻풀이 하나만 주기 때문에
 * (예문도 전혀 없음) 상세 화면엔 이 호출이 필요하다. */
async function fetchPosGroups(targetCode: string, key: string): Promise<DictionaryPosGroup[]> {
  const params = new URLSearchParams({ key, method: "target_code", q: targetCode });
  const res = await fetch(`https://stdict.korean.go.kr/api/view.do?${params}`, { cache: "no-store" });
  const text = await res.text();
  if (!text.trim()) return [];

  let data: {
    channel?: {
      item?: {
        word_info?: {
          pos_info?: {
            pos?: string;
            comm_pattern_info?: {
              sense_info?: {
                definition?: unknown;
                example_info?: { example?: unknown }[];
              }[];
            }[];
          }[];
        };
      }[];
    };
  };
  try {
    data = xmlParser.parse(text);
  } catch {
    return [];
  }

  const item = data.channel?.item?.[0];
  const posInfos = item?.word_info?.pos_info ?? [];

  const groups: DictionaryPosGroup[] = [];
  for (const posInfo of posInfos) {
    const senses: DictionarySense[] = [];
    for (const pattern of posInfo.comm_pattern_info ?? []) {
      for (const s of pattern.sense_info ?? []) {
        const definition = asText(s.definition);
        if (!definition) continue;
        const examples = (s.example_info ?? []).map((e) => asText(e.example)).filter(Boolean);
        senses.push({ definition, examples });
      }
    }
    if (senses.length > 0) {
      groups.push({ pos: asText(posInfo.pos) || "품사 미상", senses });
    }
  }
  return groups;
}

/** 국립국어원 표준국어대사전 Open API 검색 — 학원 특성상 다의어의 모든
 * 뜻과 예문까지 다 보여줘야 해서, search.do로 동형어 목록을 먼저 받고
 * (예: "가다" → 동사/부사/명사 등 별개 표제어 여럿) 표제어마다 view.do로
 * 전체 상세를 병렬로 가져온다. */
export async function searchDictionary(query: string): Promise<DictionaryEntry[]> {
  const key = process.env.STDICT_API_KEY;
  const q = query.trim();
  if (!key || !q) return [];

  const params = new URLSearchParams({ key, q, req_type: "json", num: "10" });
  const res = await fetch(`https://stdict.korean.go.kr/api/search.do?${params}`, { cache: "no-store" });
  const text = await res.text();
  if (!text.trim()) return [];

  let data: { channel?: { item?: StdictSearchItem | StdictSearchItem[] } };
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  const raw = data.channel?.item;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];

  return Promise.all(
    items.map(async (item) => {
      const sense = Array.isArray(item.sense) ? item.sense[0] : item.sense;
      const posGroups = await fetchPosGroups(item.target_code, key);
      return {
        word: item.word,
        origin: item.origin?.trim() || null,
        posGroups,
        link: sense?.link ?? "",
      };
    })
  );
}
