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

if (!idField || !pwField) {
  console.log("\n⚠️ 로그인 칸을 못 찾았어요. --save 로 HTML을 남겨 확인이 필요합니다.");
} else {
  const action = forms(html)[0]?.action;
  const postUrl = !action || action === "(없음)" ? loginUrl : new URL(action, loginUrl).toString();
  res = await post(postUrl, { ...hidden, [idField.name]: ID, [pwField.name]: PW });
  const loc = res.headers.get("location");
  console.log(`\nPOST 로그인 → ${res.status}${loc ? ` → ${loc}` : ""}`);
  console.log(`받은 쿠키: ${[...jar.keys()].join(", ") || "(없음)"}`);

  let afterUrl = loc ? new URL(loc, postUrl).toString() : postUrl;
  res = await get(afterUrl);
  html = await res.text();
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
