#!/usr/bin/env node
/**
 * 맥가이7 연동 준비 조사 — 스크래퍼를 쓰기 전에 "로그인이 어떻게 도는지"와
 * "등하원명단 표가 어떻게 생겼는지"를 알아내는 도구.
 *
 *   npm run macgai:probe                       # 로그인까지만
 *   npm run macgai:probe -- /Attend/List.aspx  # 그 페이지까지 조사
 *
 * MACGAI7_ID / MACGAI7_PASSWORD 를 환경변수로 넣고 돌린다. 비밀번호를
 * 명령줄에 적지 말 것 — 셸 기록에 남는다.
 *
 * ── 개인정보 원칙 ────────────────────────────────────────────────
 * 이 스크립트는 **구조만** 출력한다. 표의 칸 이름·개수·형식은 보여주지만
 * 이름·전화번호 같은 값은 ●로 가린다. 출력 결과를 그대로 붙여넣어도
 * 학생 정보가 새지 않게 하려는 것이다. 원본 HTML은 --save 를 줘야만
 * 파일로 남고, 그 파일은 절대 공유하지 말 것.
 */

const BASE = process.env.MACGAI7_BASE ?? "https://edu.macgai7.com";
const ID = process.env.MACGAI7_ID;
const PW = process.env.MACGAI7_PASSWORD;

const args = process.argv.slice(2);
const SAVE = args.includes("--save");
const targetPath = args.find((a) => a.startsWith("/"));

if (!ID || !PW) {
  console.error("MACGAI7_ID / MACGAI7_PASSWORD 를 환경변수로 넣어주세요.");
  console.error('예) MACGAI7_ID=xxx MACGAI7_PASSWORD=yyy npm run macgai:probe');
  process.exit(1);
}

// ── 출력에서 아이디·비밀번호 지우기 ──────────────────────────────
// 화면이 돌려주는 오류 문구에 아이디가 그대로 박혀 나오는 경우가 있다.
// 출력을 통째로 복사해 붙여넣어도 되게, 찍기 직전에 한 번 더 지운다.
const rawLog = console.log.bind(console);
const secrets = [PW, ID].filter((s) => s && s.length >= 3);
console.log = (...parts) =>
  rawLog(
    ...parts.map((p) => {
      if (typeof p !== "string") return p;
      let s = p;
      for (const secret of secrets) s = s.split(secret).join("(가림)");
      return s;
    })
  );

// ── 쿠키 단지 ────────────────────────────────────────────────────
const jar = new Map();
function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

async function get(url) {
  const res = await fetch(url, {
    headers: { cookie: cookieHeader(), "user-agent": "Mozilla/5.0 (macgai7-probe)" },
    redirect: "manual",
  });
  storeCookies(res);
  return res;
}

async function post(url, form) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      cookie: cookieHeader(),
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Mozilla/5.0 (macgai7-probe)",
    },
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
  storeCookies(res);
  return res;
}

// ── 아주 작은 HTML 뜯어보기 (의존성 없이) ────────────────────────
function inputs(html) {
  const out = [];
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (n) => (tag.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    const name = attr("name") ?? attr("id");
    if (!name) continue;
    const value = attr("value") ?? "";
    out.push({ name, type: (attr("type") ?? "text").toLowerCase(), len: value.length, value });
  }
  return out;
}

function forms(html) {
  return [...html.matchAll(/<form\b[^>]*>/gi)].map((m) => {
    const tag = m[0];
    const attr = (n) => (tag.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    return { action: attr("action") ?? "(없음)", method: (attr("method") ?? "get").toUpperCase() };
  });
}

const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** 값은 가리고 모양만 남긴다: "김민찬"→"●●●", "22:04"→"99:99", "56501"→"99999" */
function shape(text) {
  return text
    .replace(/\d/g, "9")
    .replace(/[가-힣]/g, "●")
    .replace(/[A-Za-z]/g, "A")
    .slice(0, 24);
}

/**
 * 표 뜯어보기 — **표 안에 표가 있는 경우**를 제대로 다룬다.
 *
 * ASP.NET GridView는 표를 겹쳐 쓴다. 정규식으로 `<table>…</table>`을 대충
 * 짝지으면 첫 `</table>`에서 끊겨 바깥 표를 통째로 놓친다. 실제로 그래서
 * 출결 표를 못 찾고 안내문 표만 잡은 적이 있다. 여기서는 여는/닫는 태그를
 * 세어 짝을 맞추고, 각 표의 **자기 줄만** (안쪽 표의 줄은 빼고) 읽는다.
 */
function tables(html) {
  const marks = [...html.matchAll(/<table\b[^>]*>|<\/table\s*>/gi)];
  const regions = [];
  const stack = [];
  for (const m of marks) {
    if (m[0][1] !== "/") stack.push(m.index);
    else {
      const start = stack.pop();
      if (start !== undefined) regions.push({ start, end: m.index + m[0].length });
    }
  }
  regions.sort((a, b) => a.start - b.start);

  return regions.map((r, i) => {
    let body = html.slice(r.start, r.end);
    // 안쪽 표는 지운다 — 그 줄까지 세면 바깥 표가 엉뚱하게 커진다.
    for (const inner of regions) {
      if (inner.start > r.start && inner.end < r.end) {
        body =
          body.slice(0, inner.start - r.start) +
          " ".repeat(inner.end - inner.start) +
          body.slice(inner.end - r.start);
      }
    }
    const rows = [...body.matchAll(/<tr\b[\s\S]*?<\/tr\s*>/gi)].map((tr) =>
      [...tr[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map((c) => strip(c[1]))
    );
    return { index: i, rowCount: rows.length, rows };
  });
}

/** 출결 명단처럼 보이는 표인가 — 학번·등원 같은 머리글이 있으면. */
function looksLikeAttendance(t) {
  const head = (t.rows[0] ?? []).join(" ");
  return /학번|등원|하원|출결|이름/.test(head);
}

// ── 자바스크립트 뒤지기 ──────────────────────────────────────────
// 로그인이 폼 전송이 아니라 **AJAX 호출**인 사이트가 있다(맥가이7이 그렇다).
// 그러면 진짜 로그인 주소는 HTML이 아니라 스크립트 안에 적혀 있다.

/** 페이지에 붙은 스크립트 — 인라인 본문과 외부 파일 주소. */
function scriptSources(html) {
  const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((s) => s.trim().length > 20);
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  return { inline, srcs };
}

/**
 * 중괄호 짝을 맞춰 함수 하나를 통째로 잘라낸다.
 *
 * `function 이름(` 뿐 아니라 `이름 = function(`, `이름: function(`,
 * `prototype.이름 = function(` 꼴도 찾는다 — 프레임워크 메서드(Reset 같은)는
 * 대부분 이쪽이라, 앞의 한 가지만 보면 "못 찾음"으로 조용히 지나간다.
 */
function extractFunction(js, name) {
  const patterns = [
    `function\\s+${name}\\s*\\(`,
    `\\b${name}\\s*[=:]\\s*function\\s*\\(`,
    `\\.${name}\\s*=\\s*function\\s*\\(`,
  ];
  let start = -1;
  for (const p of patterns) {
    start = js.search(new RegExp(p));
    if (start >= 0) break;
  }
  if (start < 0) return null;
  const open = js.indexOf("{", start);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < js.length; i++) {
    if (js[i] === "{") depth++;
    else if (js[i] === "}") {
      depth--;
      if (depth === 0) return js.slice(start, i + 1);
    }
  }
  return js.slice(start, start + 2000);
}

/**
 * 어떤 글자가 들어 있는 **함수를 통째로** 꺼낸다.
 *
 * 함수 이름을 모를 때 쓴다 — "class_reset_S03을 부르는 곳"처럼 찾는 대상은
 * 아는데 어느 함수에 있는지 모르는 경우. 이름을 찍어 맞히다 보면 왕복만 는다.
 */
function extractEnclosingFunction(js, needle) {
  const at = js.indexOf(needle);
  if (at < 0) return null;
  // 그 지점 앞의 function 시작점들을 가까운 것부터 훑어, 실제로 감싸는 것을 찾는다.
  const starts = [...js.slice(0, at).matchAll(/function\s*\w*\s*\(/g)].map((m) => m.index).reverse();
  for (const start of starts.slice(0, 40)) {
    const open = js.indexOf("{", start);
    if (open < 0) continue;
    let depth = 0;
    for (let i = open; i < js.length; i++) {
      if (js[i] === "{") depth++;
      else if (js[i] === "}") {
        depth--;
        if (depth === 0) {
          if (i > at) return js.slice(start, i + 1); // 이 함수가 needle을 감쌌다
          break;
        }
      }
    }
  }
  return null;
}

/** AJAX로 어디를 부르는지 — url:, $.ajax, PageMethods, .asmx/.ashx 등. */
function ajaxHints(js) {
  const out = new Set();
  for (const m of js.matchAll(/\burl\s*:\s*["'`]([^"'`]{2,160})["'`]/g)) out.add(`url: ${m[1]}`);
  for (const m of js.matchAll(/\$\.(ajax|post|get)\s*\(\s*["']([^"']{2,160})["']/g)) out.add(`$.${m[1]}: ${m[2]}`);
  for (const m of js.matchAll(/PageMethods\.(\w+)/g)) out.add(`PageMethods.${m[1]}`);
  for (const m of js.matchAll(/["'`]([^"'`]*\.(?:asmx|ashx|json|do)(?:\/\w+)?)["'`]/gi)) out.add(`파일: ${m[1]}`);
  for (const m of js.matchAll(/["'`](\/[A-Za-z0-9_\-/]*(?:login|Login|LOGIN)[A-Za-z0-9_\-/.]*)["'`]/g)) out.add(`경로: ${m[1]}`);
  return [...out].slice(0, 25);
}

/**
 * `__doPostBack('컨트롤이름','')` 로 넘어가는 대상들.
 *
 * ASP.NET WebForms는 submit 버튼이 없고 링크가 이걸 부르는 경우가 많다.
 * 그때는 POST에 __EVENTTARGET을 같이 넣어야 서버가 "그 버튼을 눌렀다"고
 * 알아듣는다 — 안 넣으면 아무 일도 없이 같은 화면이 돌아온다.
 */
function postBackTargets(html) {
  const out = new Map();
  for (const m of html.matchAll(/__doPostBack\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/g)) {
    out.set(m[1], m[2]);
  }
  // ASP.NET이 이름에 $를 쓰지만 HTML에는 &#39; 등으로 인코딩돼 나올 때가 있다.
  for (const m of html.matchAll(/__doPostBack\(&#39;([^&]+)&#39;,&#39;([^&]*)&#39;/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

/** 눌러야 하는 물건들 — a/button/image 버튼. submit input이 없을 때 여기 있다. */
function clickables(html) {
  const out = [];
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]{0,60}?)<\/\1>/gi)) {
    const attrs = m[2];
    const text = strip(m[3]);
    const attr = (n) => (attrs.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    const href = attr("href") ?? "";
    const onclick = attr("onclick") ?? "";
    if (!/login|로그인|submit|확인/i.test(`${text} ${attr("id") ?? ""} ${attr("name") ?? ""}`)) continue;
    out.push({ tag: m[1], id: attr("id"), name: attr("name"), text, hint: (href + onclick).slice(0, 120) });
  }
  for (const m of html.matchAll(/<input\b[^>]*type\s*=\s*["'](submit|image|button)["'][^>]*>/gi)) {
    const tag = m[0];
    const attr = (n) => (tag.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    out.push({ tag: `input[${m[1]}]`, id: attr("id"), name: attr("name"), text: attr("value") ?? "", hint: "" });
  }
  return out;
}

/**
 * 로그인 실패 사유로 **실제로 돌아온** 문구.
 *
 * 스크립트 블록은 먼저 걷어낸다 — 페이지 JS에는 "아이디를 입력해 주세요"
 * 같은 **모든 경우의 메시지**가 다 적혀 있어서, 그걸 같이 긁으면 서버가
 * 하지도 않은 말을 한 것처럼 보인다. 실제로 그렇게 잘못 읽은 적이 있다.
 */
function messages(html) {
  const noScript = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  const found = [];
  for (const m of noScript.matchAll(/alert\s*\(\s*['"]([^'"]{2,120})['"]/g)) found.push(m[1]);
  for (const m of noScript.matchAll(/(아이디|비밀번호|패스워드|로그인)[^<>{}]{0,60}(않|없|틀|실패|확인|오류|잠)[^<>{}]{0,20}/g)) {
    found.push(strip(m[0]));
  }
  // 같은 문구가 alert에서 한 번, 본문 훑기에서 한 번 잡혀 두 줄로 찍히는 걸 막는다.
  const seen = new Map();
  for (const raw of found) {
    const text = raw.replace(/['"\);]+\s*$/, "").trim();
    const key = text.replace(/[\s.!]/g, "");
    if (key.length >= 3 && !seen.has(key)) seen.set(key, text);
  }
  return [...seen.values()].slice(0, 6);
}

function excelHints(html) {
  const hits = new Set();
  for (const m of html.matchAll(/(href|onclick|action)\s*=\s*["']([^"']*)["']/gi)) {
    const v = m[2];
    if (/excel|xls|엑셀|download|export/i.test(v)) hits.add(v.slice(0, 160));
  }
  for (const m of html.matchAll(/<[^>]*>\s*(엑셀[^<]{0,10})</gi)) hits.add(`(버튼 글자) ${m[1]}`);
  return [...hits];
}

// ── 본 조사 ──────────────────────────────────────────────────────
const saved = [];
async function maybeSave(name, html) {
  if (!SAVE) return;
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir("macgai7-probe", { recursive: true });
  const p = `macgai7-probe/${name}.html`;
  await writeFile(p, html, "utf8");
  saved.push(p);
}

function report(title, html) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 46 - title.length))}`);
  const f = forms(html);
  if (f.length) {
    console.log("  form:");
    for (const x of f) console.log(`    ${x.method} ${x.action}`);
  }
  const ins = inputs(html);
  if (ins.length) {
    console.log("  input 칸:");
    for (const x of ins) {
      // 조회 조건(날짜·라디오)은 **값을 봐야** 어떻게 불러야 할지 알 수 있다.
      // 사람 이름이 들어올 자리는 ●로 가린다.
      const val = x.type === "hidden" ? `  (hidden, 값 ${x.len}자)` : x.value ? `  = "${maskKorean(x.value)}"` : "";
      console.log(`    ${x.name}  [${x.type}]${val}`);
    }
  }
  const sels = selects(html);
  if (sels.length) {
    console.log("  select 칸:");
    for (const s of sels) console.log(`    ${s.name}: ${s.options.slice(0, 12).join(" / ")}`);
  }
  const pb = postBackTargets(html);
  if (pb.size) {
    console.log(`  __doPostBack 대상 ${pb.size}개 (조회 버튼이 여기 있다):`);
    for (const [t, a] of [...pb].slice(0, 25)) console.log(`    ${t}${a ? ` (인자 ${a})` : ""}`);
  }
  const ex = excelHints(html);
  if (ex.length) {
    console.log("  엑셀/내려받기 단서:");
    for (const x of ex) console.log(`    ${x}`);
  }
  const ts = tables(html).filter((t) => t.rowCount >= 2);
  if (ts.length) {
    // 출결처럼 보이는 표를 먼저 — 안내문 표에 밀려 안 보이면 안 된다.
    const sorted = [...ts].sort((a, b) => Number(looksLikeAttendance(b)) - Number(looksLikeAttendance(a)));
    console.log(`  표 ${ts.length}개 (출결처럼 보이는 것 먼저):`);
    for (const t of sorted.slice(0, 8)) {
      const head = t.rows[0] ?? [];
      const flag = looksLikeAttendance(t) ? " 🎯" : "";
      console.log(`    [표#${t.index}] ${t.rowCount}줄 · ${head.length}칸${flag}`);
      if (head.length) console.log(`      머리글: ${head.join(" | ")}`);
      // 값은 가리고 모양만 — 이름·전화번호가 그대로 찍히면 안 된다.
      for (const sample of t.rows.slice(1, looksLikeAttendance(t) ? 3 : 2)) {
        console.log(`      줄 모양: ${sample.map(shape).join(" | ")}`);
      }
    }
  } else {
    console.log("  표를 못 찾았어요 — 조회 버튼을 눌러야 목록이 채워지는 화면일 수 있습니다.");
  }
}

/** 그 화면의 스크립트를 모은다 — 인라인 + 같은 도메인의 외부 .js. */
async function gatherJs(pageHtml, baseUrl) {
  const { inline, srcs } = scriptSources(pageHtml);
  let all = inline.join("\n");
  for (const src of srcs.slice(0, 12)) {
    try {
      const u = new URL(src, baseUrl);
      if (u.origin !== new URL(baseUrl).origin) continue;
      const r = await get(u.toString());
      if (r.ok) all += `\n/* ==== ${src} ==== */\n` + (await r.text());
    } catch {
      // 못 받아도 인라인만으로 찾아지는 경우가 많다.
    }
  }
  return all;
}

/** 누를 수 있는 것 **전부** — 로그인 화면과 달리 여기선 조회 버튼 이름을 모른다. */
function allClickables(html) {
  const out = [];
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]{0,80}?)<\/\1\s*>/gi)) {
    const attrs = m[2];
    const attr = (n) => (attrs.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    const act = (attr("onclick") ?? attr("href") ?? "").trim();
    const text = strip(m[3]);
    if (!act || act === "#") continue;
    out.push(`<${m[1]}> "${maskKorean(text) || "(글자없음)"}" ${attr("id") ? `id=${attr("id")} ` : ""}→ ${act.slice(0, 110)}`);
  }
  for (const m of html.matchAll(/<(input|img)\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (n) => (tag.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    const act = attr("onclick");
    const type = (attr("type") ?? "").toLowerCase();
    if (!act && !["submit", "image", "button"].includes(type)) continue;
    out.push(
      `<${m[1]}${type ? `:${type}` : ""}> "${maskKorean(attr("value") ?? attr("alt") ?? "")}" ${attr("name") ? `name=${attr("name")} ` : ""}→ ${(act ?? "(submit)").slice(0, 110)}`
    );
  }
  return out;
}

/**
 * 화면이 부르는 /job/*.aspx 주소를 앞뒤 문맥과 함께 — 목록을 채우는 데
 * 필요한 **다른 조회**(학급 목록 등)가 어디서 오는지 찾는 데 쓴다.
 */
function jobCalls(js) {
  const out = new Set();
  for (const m of js.matchAll(/["'](\/job\/[\w./-]+\.aspx)["']/g)) {
    const around = js.slice(Math.max(0, m.index - 90), m.index + 150).replace(/\s+/g, " ").trim();
    out.add(`${m[1]}\n        …${around}…`);
  }
  return [...out];
}

/**
 * 맥가이7 /job/*.aspx 응답 읽기.
 *
 * 모양: `[ {STATUS,DESCRIPTION}, {COL:"A:STRING(-1),B:DECIMAL(-1),…"}, …줄들 ]`
 * 줄이 객체로 오는지 배열로 오는지는 화면마다 다를 수 있어 둘 다 받아준다.
 */
function parseJobResponse(text) {
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    return { ok: false, cols: [], rows: [], raw: text };
  }
  if (!Array.isArray(arr)) return { ok: false, cols: [], rows: [], raw: text };

  const status = arr.find((e) => e && typeof e === "object" && "STATUS" in e);
  const colDef = arr.find((e) => e && typeof e === "object" && "COL" in e);
  const cols = colDef
    ? String(colDef.COL)
        .split(",")
        .map((c) => c.split(":")[0].trim())
        .filter(Boolean)
    : [];

  // STATUS·COL 칸을 뺀 나머지가 줄이다.
  const rest = arr.filter((e) => e !== status && e !== colDef);
  const rows = [];
  for (const e of rest) {
    if (Array.isArray(e)) {
      // 배열로 오면 COL 순서대로 짝지어 준다.
      for (const r of e) {
        if (Array.isArray(r)) rows.push(Object.fromEntries(cols.map((c, i) => [c, r[i]])));
        else if (r && typeof r === "object") rows.push(r);
      }
    } else if (e && typeof e === "object") {
      rows.push(e);
    }
  }
  return { ok: status?.STATUS === "OK", desc: status?.DESCRIPTION ?? "", cols, rows, raw: text };
}

/** argString 통째로 POST — 맥가이7이 실제로 쓰는 방식(조사로 확인됨). */
async function jobCall(path, fields) {
  const argString = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { cookie: cookieHeader(), "content-type": "application/x-www-form-urlencoded" },
    body: argString,
  });
  storeCookies(r);
  return { res: r, text: await r.text(), argString };
}

/** 그 화면 스크립트가 정의한 fn_* 함수 이름들 — 조회 함수가 여기 있다. */
function definedFunctions(js) {
  return [...new Set([...js.matchAll(/function\s+(fn_\w+)\s*\(/g)].map((m) => m[1]))];
}

/** 한글만 가린다 — 길이는 안 자른다. 응답 본문처럼 통째로 봐야 할 때 쓴다. */
function maskNames(s) {
  return s.replace(/[가-힣]/g, "●");
}

/** 칸 값처럼 짧게 보여줄 자리용 — 가리고 40자에서 자른다. */
function maskKorean(s) {
  return maskNames(s).slice(0, 40);
}

function selects(html) {
  return [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select\s*>/gi)].map((m) => {
    const attrs = m[1];
    const name = (attrs.match(/name\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? "(이름없음)";
    const options = [...m[2].matchAll(/<option\b[^>]*value\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)].map(
      (o) => `${o[1]}=${maskKorean(strip(o[2]))}`
    );
    return { name, options };
  });
}

const loginUrl = `${BASE}/`;
console.log(`맥가이7 조사 시작 — ${BASE}`);
console.log("값은 가려서 출력합니다. 그대로 붙여넣어도 괜찮아요.\n");

let res = await get(loginUrl);
console.log(`GET / → ${res.status}${res.headers.get("location") ? ` → ${res.headers.get("location")}` : ""}`);
// 첫 화면에서 세션 쿠키를 주는지 — 안 주면 로그인 성공 여부를 쿠키로 판단할 수 없다.
console.log(`첫 화면이 준 쿠키: ${[...jar.keys()].join(", ") || "(없음)"}`);
let html = await res.text();
await maybeSave("1-login", html);
report("로그인 화면", html);

// ASP.NET 숨은 필드를 그대로 되돌려주고 아이디/비번을 얹는다.
const hidden = Object.fromEntries(
  [...html.matchAll(/<input\b[^>]*type\s*=\s*["']hidden["'][^>]*>/gi)].map((m) => {
    const tag = m[0];
    const attr = (n) => (tag.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    return [attr("name") ?? "", attr("value") ?? ""];
  }).filter(([k]) => k)
);

const idField = inputs(html).find((i) => /id|user|login/i.test(i.name) && i.type !== "hidden");
const pwField = inputs(html).find((i) => i.type === "password");
console.log(`\n추정한 아이디 칸: ${idField?.name ?? "(못 찾음)"} / 비번 칸: ${pwField?.name ?? "(못 찾음)"}`);

// submit 버튼이 없으면 링크가 __doPostBack을 부른다 — 그 이름을 같이 보내야 한다.
const targets = postBackTargets(html);
const clicks = clickables(html);

// 로그인이 AJAX면 진짜 주소가 스크립트 안에 있다. 외부 .js까지 받아서 뒤진다.
const { inline, srcs } = scriptSources(html);
let allJs = inline.join("\n");
if (srcs.length) console.log(`\n  외부 스크립트 ${srcs.length}개: ${srcs.slice(0, 10).join(", ")}`);
for (const src of srcs.slice(0, 12)) {
  try {
    const u = new URL(src, loginUrl);
    if (u.origin !== new URL(loginUrl).origin) continue; // 남의 서버(jQuery CDN 등)는 건너뛴다
    const r = await get(u.toString());
    if (r.ok) allJs += "\n/* ==== " + src + " ==== */\n" + (await r.text());
  } catch {
    // 못 받아도 그만 — 인라인 스크립트만으로 찾아지는 경우가 많다.
  }
}

// 버튼이 부르는 함수(onclick의 fn_XXX())를 통째로 꺼내 본다.
const fnNames = new Set();
for (const c of clicks) for (const m of (c.hint ?? "").matchAll(/\b(fn_\w+|\w*[Ll]ogin\w*)\s*\(/g)) fnNames.add(m[1]);
// --fn=이름 으로 지정한 함수는 **자르지 않고 전부** 보여준다. 로그인 성공
// 뒤에 세션을 어떻게 잡는지가 함수 끝자락에 있는 경우가 많아서 필요하다.
const wanted = args.filter((a) => a.startsWith("--fn=")).map((a) => a.slice("--fn=".length));
for (const name of wanted) fnNames.add(name);

let dug = 0;
for (const name of fnNames) {
  if (dug++ >= 8) break; // 함수가 서로를 부르며 끝없이 번지지 않게.
  const body = extractFunction(allJs, name);
  if (!body) {
    if (wanted.includes(name)) console.log(`\n  (${name} 함수를 못 찾았어요)`);
    continue;
  }
  const full = wanted.includes(name);
  const lines = body.split("\n");
  const shown = full ? lines.slice(0, 400) : lines.slice(0, 45);
  console.log(`\n  ── ${name}() 내용 ──${full ? " (전체)" : ""}`);
  for (const line of shown) console.log(`    ${line.trim().slice(0, 170)}`);
  if (lines.length > shown.length) {
    console.log(`    … ${lines.length - shown.length}줄 더 있음 — --fn=${name} 을 붙이면 전부 나와요`);
  }
  // 그 함수가 또 다른 함수를 부르면 그것도 한 겹 따라간다.
  for (const m of body.matchAll(/\b(fn_\w+)\s*\(/g)) if (m[1] !== name) fnNames.add(m[1]);
}

const hints = ajaxHints(allJs);
if (hints.length) {
  console.log("\n  AJAX/주소 단서:");
  for (const h of hints) console.log(`    ${h}`);
}
if (targets.size) {
  console.log("\n  __doPostBack 대상:");
  for (const [t, a] of targets) console.log(`    ${t}${a ? ` (인자 ${a})` : ""}`);
}
if (clicks.length) {
  console.log("  로그인처럼 보이는 버튼:");
  for (const c of clicks) console.log(`    <${c.tag}> id=${c.id ?? "-"} name=${c.name ?? "-"} "${c.text}" ${c.hint}`);
}

/** 로그인 버튼으로 가장 그럴듯한 __EVENTTARGET 고르기. --target= 로 강제 지정 가능. */
const forced = args.find((a) => a.startsWith("--target="))?.slice("--target=".length);
const guessed =
  forced ??
  [...targets.keys()].find((t) => /login|로그인|btn/i.test(t)) ??
  clicks.find((c) => c.name)?.name ??
  [...targets.keys()][0];

// 로그인이 AJAX인데 폼을 전송해봐야 로그인 화면만 돌아온다. 살아있는 시스템에
// 헛된 로그인 실패를 쌓지 않도록 건너뛴다(계정 잠금 위험도 줄인다).
const looksAjax = hints.length > 0 && targets.size === 0 && !clicks.some((c) => c.name);

/**
 * 맥가이7 로그인 — 조사로 알아낸 실제 흐름 그대로.
 *
 *   ① POST /job/member_login_S01.aspx  (IN_M_ID / IN_M_PASSWORD / IN_M_BRANCH)
 *      → 회원정보 배열. 비어 있으면 아이디·비번 틀림, LOGIN_LEVEL "N"이면 권한 없음.
 *   ② GET  /c_index.aspx?m_idx=…&token=…   ← 세션은 **여기서** 잡힌다.
 *
 * 화면의 Hd_* 숨은 칸들은 채워지기만 하고 전송되지 않는다. 열쇠는 TOKEN이다.
 */
async function macgaiLogin() {
  const r = await post(`${BASE}/job/member_login_S01.aspx`, {
    IN_M_ID: sanitizeInput(ID),
    IN_M_PASSWORD: sanitizeInput(PW),
    IN_M_BRANCH: "",
  });
  const text = await r.text();
  console.log(`\n① POST /job/member_login_S01.aspx → ${r.status} (응답 ${text.length}자)`);

  let rows;
  try {
    rows = parseLooseJson(text);
  } catch {
    console.log(`   ⚠️ 응답을 못 읽었어요. 앞부분: ${text.slice(0, 200)}`);
    return false;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("   ❌ 회원정보가 비었습니다 — 아이디 또는 비밀번호가 틀렸을 가능성이 큽니다.");
    return false;
  }
  const me = rows[0];
  console.log(`   받은 칸: ${Object.keys(me).join(", ")}`);
  if (me.LOGIN_LEVEL === "N") {
    console.log("   ❌ 이 계정은 로그인 권한이 없습니다(LOGIN_LEVEL=N).");
    return false;
  }
  if (!me.TOKEN || !me.M_IDX) {
    console.log("   ⚠️ M_IDX 또는 TOKEN이 없어 세션을 못 만듭니다.");
    return false;
  }

  const r2 = await get(`${BASE}/c_index.aspx?m_idx=${me.M_IDX}&token=${me.TOKEN}`);
  console.log(`② GET /c_index.aspx → ${r2.status}`);
  console.log(`   받은 쿠키: ${[...jar.keys()].join(", ") || "(없음)"}`);
  html = await r2.text();
  const stillLogin = /id\s*=\s*["']txt_M_PASSWORD["']/i.test(html);
  console.log(`   ${stillLogin ? "❌ 아직 로그인 화면" : "✅ 로그인 성공으로 보입니다"}`);
  return !stillLogin;
}

/** eval(data)로 받던 응답이라 엄격한 JSON이 아닐 수 있다. 한 번 더 눅여서 읽는다. */
function parseLooseJson(text) {
  const t = text.trim().replace(/^﻿/, "");
  try {
    return JSON.parse(t);
  } catch {
    // 키에 따옴표가 없거나 홑따옴표를 쓰는 경우.
    const fixed = t.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"');
    return JSON.parse(fixed);
  }
}

/** 맥가이7이 아이디·비번에서 지우고 보내는 문자들 — 그대로 흉내내야 한다. */
function sanitizeInput(input) {
  return input.replace(/[-'"/\\;]/g, "");
}

/** 로그인 뒤 어디로 갈 수 있는지 — 메뉴·링크·iframe. 출결현황 주소를 찾는 데 쓴다. */
function navTargets(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]{0,80}?)<\/a>/gi)) {
    const attrs = m[1];
    const attr = (n) => (attrs.match(new RegExp(`${n}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1];
    const text = strip(m[2]);
    const to = attr("href") ?? attr("onclick") ?? "";
    if (!text || !to || to === "#") continue;
    out.push({ text, to: to.slice(0, 120) });
  }
  for (const m of html.matchAll(/<(iframe|frame)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    out.push({ text: `(${m[1]})`, to: m[2].slice(0, 120) });
  }
  return out;
}

if (!idField || !pwField) {
  console.log("\n⚠️ 로그인 칸을 못 찾았어요. --save 로 HTML을 남겨 확인이 필요합니다.");
} else if (looksAjax && !args.includes("--force-form")) {
  console.log("\n📌 AJAX 로그인 방식입니다. 알아낸 흐름 그대로 실제 로그인해 봅니다.");
  const ok = await macgaiLogin();
  if (ok) {
    await maybeSave("2-after-login", html);
    const navs = navTargets(html);
    // 출결 관련이 있으면 먼저 보여준다 — 우리가 찾는 건 등하원명단이다.
    const hot = navs.filter((n) => /출결|등하원|등원|하원|attend|Attend/.test(`${n.text} ${n.to}`));
    if (hot.length) {
      console.log("\n  🎯 출결로 보이는 메뉴:");
      for (const n of hot.slice(0, 15)) console.log(`    ${n.text}  →  ${n.to}`);
    }
    console.log(`\n  로그인 후 화면의 링크·프레임 ${navs.length}개 (앞 30개):`);
    for (const n of navs.slice(0, 30)) console.log(`    ${n.text}  →  ${n.to}`);
    if (!targetPath) {
      console.log("\n  위 목록에서 출결현황(등하원명단) 주소를 찾으면 다시 돌려주세요:");
      console.log("    node macgai7-probe.mjs /그/경로.aspx");
    }
  }
} else {
  const action = forms(html)[0]?.action;
  const postUrl = !action || action === "(없음)" ? loginUrl : new URL(action, loginUrl).toString();
  const body = { ...hidden, [idField.name]: ID, [pwField.name]: PW };
  if (guessed) {
    body.__EVENTTARGET = guessed;
    body.__EVENTARGUMENT = targets.get(guessed) ?? "";
    console.log(`\n__EVENTTARGET = ${guessed} 로 로그인 시도합니다.`);
  } else {
    console.log("\n⚠️ 누를 버튼을 못 찾아서 __EVENTTARGET 없이 시도합니다 (실패할 수 있어요).");
  }
  // 버튼 이름이 있으면 그 값도 같이 — 서버가 둘 중 뭘 보는지 몰라서 양쪽 다 넣는다.
  for (const c of clicks) if (c.name) body[c.name] = c.text || "로그인";

  res = await post(postUrl, body);
  const loc = res.headers.get("location");
  console.log(`\nPOST 로그인 → ${res.status}${loc ? ` → ${loc}` : ""}`);
  console.log(`받은 쿠키: ${[...jar.keys()].join(", ") || "(없음)"}`);

  // 실패 사유("비밀번호가 일치하지 않습니다")는 **POST 응답 본문**에 담겨 온다.
  // 곧바로 페이지를 다시 받아오면 그 문구가 사라져서 원인을 못 본다.
  const postedHtml = await res.text();
  const msgs = messages(postedHtml);
  if (msgs.length) {
    console.log("  화면이 말하는 것:");
    for (const m of msgs) console.log(`    ${m}`);
  }

  if (loc) {
    // 리다이렉트했다는 건 보통 로그인이 먹혔다는 뜻.
    res = await get(new URL(loc, postUrl).toString());
    html = await res.text();
  } else {
    html = postedHtml;
  }
  const stillLogin = /type\s*=\s*["']password["']/i.test(html);
  console.log(`로그인 후 화면 → ${res.status} · ${stillLogin ? "❌ 아직 로그인 화면 (실패로 보임)" : "✅ 통과한 것으로 보임"}`);
  await maybeSave("2-after-login", html);
  report("로그인 후 화면", html);

}

// 대상 화면 조사는 어느 로그인 방식이든 똑같이 해야 하므로 밖으로 뺀다.
if (targetPath) {
  const url = new URL(targetPath, BASE).toString();
  res = await get(url);
  html = await res.text();
  console.log(`\nGET ${targetPath} → ${res.status}`);
  await maybeSave("3-target", html);
  report(`대상 화면 ${targetPath}`, html);

  // 표가 화면에 없고 조회 버튼을 눌러야 채워지는 경우가 많다. 그 버튼이
  // 부르는 함수와 주소를 찾아야 스크래퍼가 목록을 불러올 수 있다.
  const tjs = await gatherJs(html, url);

  const th = ajaxHints(tjs);
  if (th.length) {
    console.log("  이 화면이 부르는 주소:");
    for (const h of th) console.log(`    ${h}`);
  }

  const clicky = allClickables(html);
  if (clicky.length) {
    console.log(`\n  누를 수 있는 것 ${clicky.length}개 (조회·엑셀 버튼을 여기서 찾는다):`);
    for (const c of clicky.slice(0, 45)) console.log(`    ${c}`);
    if (clicky.length > 45) console.log(`    … ${clicky.length - 45}개 더 있음`);
  }

  const defs = definedFunctions(tjs);
  if (defs.length) {
    console.log(`\n  이 화면이 정의한 함수 ${defs.length}개:`);
    console.log(`    ${defs.join(", ")}`);
    console.log(`    (내용을 보려면 --fn=이름 을 붙여서 다시 실행)`);

    // 조회/목록/엑셀처럼 보이는 함수는 미리 펼쳐둔다 — 목록을 불러오는
    // 방법이 거의 항상 여기 있어서, 한 번 더 왕복하지 않으려는 것.
    // 목록을 불러오는 함수 이름은 현장마다 다르다. 맥가이7은 fn_query 였는데
    // search/list만 보다가 놓쳐 왕복을 한 번 더 했다. 조회 계열 낱말을 넓게 본다.
    // 이름이 짧은 것부터 — fn_query 가 fn_top_student_query 보다 본체일 가능성이 높다.
    const likely = defs
      .filter((n) => /query|qry|search|list|inquiry|select|grid|load|view|refresh|chul|attend|출결/i.test(n))
      .sort((a, b) => a.length - b.length);
    for (const name of likely.slice(0, 4)) {
      if (wanted.includes(name)) continue; // 아래에서 전체로 다시 찍는다
      const body = extractFunction(tjs, name);
      if (!body) continue;
      const lines = body.split("\n");
      console.log(`\n  ── ${name}() 내용 ──`);
      for (const line of lines.slice(0, 60)) console.log(`    ${line.trim().slice(0, 170)}`);
      if (lines.length > 60) console.log(`    … ${lines.length - 60}줄 더 있음 — --fn=${name}`);
    }
  }

  // --fn= 으로 지정한 함수는 이 화면 스크립트에서도 찾아 보여준다.
  for (const name of wanted) {
    const body = extractFunction(tjs, name);
    if (!body) continue;
    console.log(`\n  ── [대상 화면] ${name}() 내용 ──`);
    for (const line of body.split("\n").slice(0, 400)) console.log(`    ${line.trim().slice(0, 170)}`);
  }

  // --find=글자 : 그 글자가 든 함수를 통째로. 함수 이름을 모를 때 쓴다.
  for (const needle of args.filter((a) => a.startsWith("--find=")).map((a) => a.slice("--find=".length))) {
    const fn = extractEnclosingFunction(tjs, needle);
    console.log(`\n  ── "${needle}" 가 든 함수 ──`);
    if (!fn) {
      console.log("    (못 찾았어요)");
      continue;
    }
    for (const line of fn.split("\n").slice(0, 200)) console.log(`    ${line.trim().slice(0, 170)}`);
  }
}

// ── 출결 목록 실제로 불러보기 ────────────────────────────────────
// fn_query가 dsLST1.Reset("/job/attend_S01.aspx", "in_a=1,in_b=2…") 로 부르는데,
// Reset이 그 문자열을 **어떤 모양으로** 서버에 보내는지는 코드만 봐선 모른다.
// 그래서 그럴듯한 세 가지를 실제로 던져보고 어느 게 데이터를 주는지 본다.
const attendDate = args.find((a) => a.startsWith("--attend="))?.slice("--attend=".length);
if (attendDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendDate)) {
    console.log(`\n⚠️ --attend= 는 2026-08-08 같은 모양이어야 해요 (받은 값: ${attendDate})`);
  } else {
    // 화면 스크립트에 박혀 있는 전역값. 없으면 빈 값으로 시도한다.
    const pageJs = await gatherJs(html, `${BASE}/teacher/schedule/attend.aspx`);
    const branch = (pageJs.match(/\bM_BRANCH\s*=\s*["']([^"']*)["']/) ?? [])[1] ?? "";
    console.log(`\n── 출결 목록 불러오기 (${attendDate}) ──`);
    console.log(`  M_BRANCH = ${branch || "(못 찾음 — 빈 값으로 시도)"}`);

    const fields = {
      in_m_branch: branch,
      in_yyyymmdd: attendDate,
      in_bigcategory: "",
      in_category: "",
      in_class: "",
      in_inout: "",
      in_m_grade: "",
      in_teacher: "",
      in_search: "",
      in_temp: "",
      in_su_time: "",
    };
    const argString = Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    const target = `${BASE}/job/attend_S01.aspx`;

    /** 응답이 쓸 만한지 — 길이와 앞부분 모양(값은 가림)으로 판단한다. */
    const tried = [];
    const describe = async (label, r) => {
      const body = await r.text();
      const head = maskKorean(body.replace(/\s+/g, " ").slice(0, 220));
      const rowish = (body.match(/\b\d{5}\b/g) ?? []).length;
      console.log(`  [${label}] → ${r.status} · ${body.length}자 · 5자리숫자 ${rowish}개`);
      console.log(`     앞부분: ${head}`);
      tried.push({ label, body });
      return body.length;
    };

    // ① 항목마다 form 필드로
    await describe("① form 필드", await post(target, fields));
    // ② argString을 통째로 (흔한 사내 프레임워크 방식)
    await describe(
      "② argString 통째로",
      await fetch(target, {
        method: "POST",
        headers: { cookie: cookieHeader(), "content-type": "application/x-www-form-urlencoded" },
        body: argString,
      })
    );
    // ③ 쿼리스트링으로 GET
    await describe("③ GET 쿼리스트링", await get(`${target}?${new URLSearchParams(fields)}`));

    console.log("  ↳ 셋 중 길이가 길고 5자리 숫자(학번)가 여럿 보이는 것이 정답입니다.");

    // 이긴 응답은 통째로 본다. 줄이 0개일 때 "왜 비었나"(칸 이름은 뭔지,
    // 어떤 조건이 빠졌는지)가 응답 안에 적혀 있는 경우가 많다.
    const best = tried.sort((a, b) => b.body.length - a.body.length)[0];
    if (best) {
      console.log(`\n  ── ${best.label} 응답 전문 ──`);
      console.log(maskNames(best.body).slice(0, 2500).replace(/^/gm, "    "));
    }

    // 학급 목록(dsCLASS)을 어디서 받아오는지 — in_class가 비면 줄이 안 온다.
    const calls = jobCalls(pageJs);
    if (calls.length) {
      console.log(`\n  이 화면이 부르는 /job/ 주소 ${calls.length}개:`);
      for (const c of calls.slice(0, 20)) console.log(`    ${c}`);
    }
    const dsLines = [...new Set(
      pageJs.split("\n").map((l) => l.trim()).filter((l) => /dsCLASS/.test(l) && /Reset|progid|\/job\//.test(l))
    )];
    if (dsLines.length) {
      console.log("\n  dsCLASS(학급 목록) 관련 줄:");
      for (const l of dsLines.slice(0, 15)) console.log(`    ${l.slice(0, 170)}`);
    }

    // ── 2단계: 학급 목록을 먼저 받아서 그걸로 출결을 조회한다 ──────
    // in_class가 비면 줄이 안 온다. fn_query가 dsCLASS에서 C_IDX·T_TEMP를
    // 모아 "||"로 이어 붙이는 것을 그대로 흉내낸다.
    console.log("\n── 2단계: 학급 목록 → 출결 조회 ──");
    // fn_class_change가 넘기는 조건 여섯 개를 그대로. 하나라도 빠지면 서버가
    // "Fatal error"를 뱉는다 — 빈 값은 괜찮지만 **칸 자체가 없으면** 안 된다.
    const staffOpt = selects(html).find((s) => s.name === "sel_staff")?.options ?? [];
    const staff = staffOpt.map((o) => o.split("=")[0]).find(Boolean) ?? "";
    console.log(`  강사(sel_staff) = ${staff || "(비움)"}`);

    const classArgs = (teacher) => ({
      in_c_branch: branch,
      in_c_yyyymmdd: attendDate,
      in_c_grade: "",
      in_c_category: "",
      in_c_bigcategory: "",
      in_c_teacher: teacher,
    });

    let cls = await jobCall("/job/class_reset_S03.aspx", classArgs(staff));
    let parsedCls = parseJobResponse(cls.text);
    // 강사를 좁혀 아무것도 안 나오면 전체로 한 번 더 — 조회 전용 계정이
    // 다른 강사로 잡혀 있을 수 있다.
    if (parsedCls.rows.length === 0 && staff) {
      console.log("  (그 강사로는 학급이 없어 전체 강사로 다시 시도합니다)");
      cls = await jobCall("/job/class_reset_S03.aspx", classArgs(""));
      parsedCls = parseJobResponse(cls.text);
    }
    console.log(`  [학급 목록] → ${cls.res.status} · ${cls.text.length}자 · STATUS ${parsedCls.ok ? "OK" : parsedCls.desc || "?"}`);
    console.log(`  칸: ${parsedCls.cols.join(", ") || "(못 읽음)"}`);
    console.log(`  줄 수: ${parsedCls.rows.length}`);
    if (parsedCls.rows.length === 0) {
      console.log("  ── 학급 목록 응답 전문 ──");
      console.log(maskNames(cls.text).slice(0, 2500).replace(/^/gm, "    "));
    } else {
      console.log(`  첫 줄: ${maskNames(JSON.stringify(parsedCls.rows[0])).slice(0, 300)}`);
    }

    const pick = (row, ...names) => {
      for (const n of names) if (row[n] !== undefined && row[n] !== null) return String(row[n]);
      return "";
    };
    const cIdx = parsedCls.rows.map((r) => pick(r, "C_IDX", "c_idx")).filter(Boolean);
    const tTemp = parsedCls.rows.map((r) => pick(r, "T_TEMP", "t_temp")).filter(Boolean);

    if (cIdx.length === 0) {
      console.log("  ↳ 학급 번호(C_IDX)를 못 뽑았습니다.");
      // 조건을 잘못 보냈을 때가 대부분이다. 그 호출이 든 함수를 통째로 보여주면
      // 뭐가 빠졌는지 바로 드러난다 — 함수 이름을 찍어 맞히느라 왕복하지 않는다.
      for (const needle of ["class_reset_S03", "class_reset_S02", "category_reset_S01"]) {
        const fn = extractEnclosingFunction(pageJs, needle);
        if (!fn) continue;
        console.log(`\n  ── ${needle} 를 부르는 함수 전문 ──`);
        for (const line of fn.split("\n").slice(0, 120)) console.log(`    ${line.trim().slice(0, 170)}`);
        break;
      }
    } else {
      console.log(`  학급 ${cIdx.length}개를 찾았습니다. 이걸로 출결을 다시 조회합니다.`);
      const att = await jobCall("/job/attend_S01.aspx", {
        ...fields,
        in_teacher: staff, // fn_query도 sel_staff 값을 그대로 넘긴다
        in_class: cIdx.join("||"),
        in_temp: tTemp.join("||"),
      });
      const parsedAtt = parseJobResponse(att.text);
      console.log(`\n  [출결 목록] → ${att.res.status} · ${att.text.length}자 · STATUS ${parsedAtt.ok ? "OK" : parsedAtt.desc || "?"}`);
      console.log(`  줄 수: ${parsedAtt.rows.length}`);
      if (parsedAtt.rows.length > 0) {
        console.log("  🎯 출결 줄을 받았습니다! 앞 3줄 (값은 모양만):");
        for (const r of parsedAtt.rows.slice(0, 3)) {
          const brief = Object.fromEntries(
            Object.entries(r)
              .filter(([k]) => /M_IDX|M_NAME|IN_TIME|OUT_TIME|C_NAME|S_DATE|M_SCHOOL|STUNO|학번/i.test(k))
              .map(([k, v]) => [k, shape(String(v ?? ""))])
          );
          console.log(`    ${JSON.stringify(brief)}`);
        }
        console.log(`  전체 칸: ${parsedAtt.cols.join(", ")}`);
      } else {
        console.log("  ── 출결 응답 전문 ──");
        console.log(maskNames(att.text).slice(0, 2500).replace(/^/gm, "    "));
      }
    }
  }
}

if (saved.length) {
  console.log(`\n원본 HTML 저장됨: ${saved.join(", ")}`);
  console.log("⚠️ 이 파일에는 학생 이름·전화번호가 들어 있을 수 있어요. 공유하지 마세요.");
}
console.log("\n조사 끝. 위 출력을 그대로 종주T에게 전달하면 스크래퍼를 쓸 수 있어요.");
