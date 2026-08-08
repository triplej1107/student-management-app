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
    out.push({ name, type: (attr("type") ?? "text").toLowerCase(), len: (attr("value") ?? "").length });
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

function tables(html) {
  return [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m, i) => {
    const t = m[0];
    const rows = [...t.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((r) =>
      [...r[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => strip(c[1]))
    );
    return { index: i, rowCount: rows.length, rows };
  });
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

/** 중괄호 짝을 맞춰 함수 하나를 통째로 잘라낸다. */
function extractFunction(js, name) {
  const start = js.search(new RegExp(`function\\s+${name}\\s*\\(`));
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
      const hidden = x.type === "hidden" ? `  (hidden, 값 ${x.len}자)` : "";
      console.log(`    ${x.name}  [${x.type}]${hidden}`);
    }
  }
  const ex = excelHints(html);
  if (ex.length) {
    console.log("  엑셀/내려받기 단서:");
    for (const x of ex) console.log(`    ${x}`);
  }
  const ts = tables(html).filter((t) => t.rowCount >= 2);
  if (ts.length) {
    console.log(`  표 ${ts.length}개:`);
    for (const t of ts.slice(0, 6)) {
      const head = t.rows[0] ?? [];
      console.log(`    [표#${t.index}] ${t.rowCount}줄 · ${head.length}칸`);
      if (head.length) console.log(`      머리글: ${head.join(" | ")}`);
      const sample = t.rows[1];
      // 값은 가리고 모양만 — 이름·전화번호가 그대로 찍히면 안 된다.
      if (sample) console.log(`      첫 줄 모양: ${sample.map(shape).join(" | ")}`);
    }
  }
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

if (!idField || !pwField) {
  console.log("\n⚠️ 로그인 칸을 못 찾았어요. --save 로 HTML을 남겨 확인이 필요합니다.");
} else if (looksAjax && !args.includes("--force-form")) {
  console.log("\n📌 이 사이트는 **폼 전송이 아니라 AJAX로 로그인**하는 것으로 보입니다.");
  console.log("   위 'AJAX/주소 단서'와 함수 내용이 진짜 로그인 주소입니다.");
  console.log("   폼 전송은 어차피 실패하므로 건너뜁니다 (굳이 해보려면 --force-form).");
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

  if (targetPath) {
    const url = new URL(targetPath, BASE).toString();
    res = await get(url);
    html = await res.text();
    console.log(`\nGET ${targetPath} → ${res.status}`);
    await maybeSave("3-target", html);
    report(`대상 화면 ${targetPath}`, html);
  } else {
    console.log("\n출결현황(등하원명단) 주소를 알면 다시 돌려주세요:");
    console.log("  npm run macgai:probe -- /그/경로.aspx");
  }
}

if (saved.length) {
  console.log(`\n원본 HTML 저장됨: ${saved.join(", ")}`);
  console.log("⚠️ 이 파일에는 학생 이름·전화번호가 들어 있을 수 있어요. 공유하지 마세요.");
}
console.log("\n조사 끝. 위 출력을 그대로 종주T에게 전달하면 스크래퍼를 쓸 수 있어요.");
