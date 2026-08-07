/* 제작 작업표를 만든다 — 「뭘, 얼마 크기로, 어디까지 했나」 한 장.
 *
 *   node game-design/items/작업표-만들기.mjs
 *
 * 도감(도감-만들기.mjs)은 **다 만든 것을 보는** 페이지다. 이건 그 반대편 —
 * **아직 만들 것을 보는** 페이지다. 103종 전부를 등급·세트별로 늘어놓고,
 * 각 부위의 코드·도트 묘사·단계별 칸 수를 적고, 담긴 것은 표시한다.
 * GPT 에 던질 칸 수를 매번 계산하지 않아도 되게 하려는 것이다.
 *
 * 아이템카탈로그-v5.md 를 읽어 만든다 — 카탈로그를 고치면 여기도 따라온다.
 * 결과: game-design/items/작업표.html (생성물, .gitignore)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const CAT = readFileSync(join(DIR, '..', '아이템카탈로그-v5.md'), 'utf8');
const man = JSON.parse(readFileSync(join(DIR, 'items.json'), 'utf8'));

/* 규격서 §2 — 셀 3 기준 권장 칸 수 */
const REC = {
  head: { baby: [24, 11], teen: [30, 14], awake: [36, 17] },
  face: { baby: [15, 7], teen: [22, 11], awake: [24, 12] },
  right: { baby: [8, 18], teen: [9, 20], awake: [11, 25] },
  left: { baby: [11, 16], teen: [12, 17], awake: [15, 21] },
  fx: { baby: [41, 14], teen: [45, 15], awake: [56, 19] },
};
const TIER_K = { normal: 1, magic: 1.08, rare: 1.18, epic: 1.35, legendary: 1.6 };
const CELL = (t) => (t === 'epic' || t === 'legendary' ? 1.5 : 3);
const TIER_KO = { normal: '노말', magic: '매직', rare: '레어', epic: '에픽', legendary: '레전더리' };
const SLOT_KO = { head: '머리', face: '얼굴', right: '오른손', left: '왼손', fx: '이펙트' };
const SLOTS = ['head', 'face', 'right', 'left', 'fx'];
const KO2SLOT = { 머리: 'head', 얼굴: 'face', 오른손: 'right', 왼손: 'left', 이펙트: 'fx' };

/* 그 등급·부위·단계에 그려 올 칸 수. 셀 환산(3/cell) × 등급 덩치. 규격서 §1 */
const cells = (tier, slot, st) => {
  const k = (3 / CELL(tier)) * TIER_K[tier];
  return REC[slot][st].map((v) => Math.round(v * k));
};
// 베이비는 노말만 착용한다 (규격서 §2)
const stagesOf = (tier) => (tier === 'normal' ? ['baby', 'teen', 'awake'] : ['teen', 'awake']);

/* ── 카탈로그 읽기 ──────────────────────────────── */
const sets = [];
let tier = null;
for (const line of CAT.split('\n')) {
  const h2 = /^## (레전더리|에픽|레어|매직|노말)/.exec(line);
  if (h2) { tier = { 레전더리: 'legendary', 에픽: 'epic', 레어: 'rare', 매직: 'magic', 노말: 'normal' }[h2[1]]; continue; }
  const h3 = /^### (?:[✅⏳]\s*)?(.+?)\s*\(([a-z0-9]+)\)/.exec(line);
  if (h3 && tier && tier !== 'normal') { sets.push({ key: h3[2], ko: h3[1], tier, parts: [] }); continue; }
  const row = /^\|\s*(머리|얼굴|오른손|왼손|이펙트)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/.exec(line);
  if (row && sets.length) {
    const s = sets[sets.length - 1];
    if (s.parts.length < 5) s.parts.push({ slot: KO2SLOT[row[1]], ko: row[2], desc: row[3] });
  }
}
/* 노말 33종은 세트가 아니라 코드 표에서 읽는다 */
const normals = [];
for (const m of CAT.matchAll(/`(nm_(head|face|right|left)_[a-z0-9]+)`\s*([^·|\n]+)/g))
  normals.push({ code: m[1], slot: m[2], ko: m[3].trim(), tier: 'normal' });

/* ── 담긴 것 대조 ───────────────────────────────── */
const have = new Map(man.items.map((i) => [i.code, i]));
const doneOf = (code) => {
  const it = have.get(code);
  if (!it) return { state: 'none' };
  const arts = ['baby', 'teen', 'awake'].filter((st) => it[st]);
  return { state: 'yes', stages: arts.length, anchors: arts.map((st) => it[st].anchor) };
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const rows = [];
for (const t of ['legendary', 'epic', 'rare', 'magic']) {
  for (const s of sets.filter((x) => x.tier === t)) {
    for (const slot of SLOTS) {
      const part = s.parts.find((p) => p.slot === slot);
      rows.push({ tier: t, group: s.ko, groupKey: s.key, slot,
                  code: `${s.key}_${slot}`, ko: part ? part.ko : '—', desc: part ? part.desc : '' });
    }
  }
}
for (const slot of SLOTS.slice(0, 4))
  for (const n of normals.filter((x) => x.slot === slot))
    rows.push({ tier: 'normal', group: `노말 ${SLOT_KO[slot]}`, groupKey: 'nm_' + slot,
                slot, code: n.code, ko: n.ko, desc: '' });

const stat = {};
for (const r of rows) {
  const d = doneOf(r.code);
  r.done = d.state === 'yes';
  r.stages = d.stages || 0;
  stat[r.tier] = stat[r.tier] || { n: 0, done: 0 };
  stat[r.tier].n++; if (r.done) stat[r.tier].done++;
}
const total = rows.length, totalDone = rows.filter((r) => r.done).length;

/* ── 페이지 ─────────────────────────────────────── */
const groups = [];
for (const r of rows) {
  const g = groups[groups.length - 1];
  if (g && g.key === r.groupKey) g.rows.push(r);
  else groups.push({ key: r.groupKey, ko: r.group, tier: r.tier, rows: [r] });
}

const card = (g) => {
  const done = g.rows.filter((r) => r.done).length;
  const sts = stagesOf(g.tier);
  return `
<section class="grp" data-tier="${g.tier}" data-left="${done < g.rows.length ? 1 : 0}">
  <h3><span class="tier t-${g.tier}">${TIER_KO[g.tier]}</span>${esc(g.ko)}
    <b class="${done >= g.rows.length ? 'ok' : ''}">${done}/${g.rows.length}</b>
    <span class="spec">한 칸 ${CELL(g.tier)} · 덩치 ×${TIER_K[g.tier]} · ${sts.map((s) => ({ baby: '베', teen: '틴', awake: '각' }[s])).join('·')} ${sts.length}벌</span></h3>
  <div class="scroll"><table>
    <thead><tr><th></th><th>부위</th><th>이름</th><th>코드</th>${
      sts.map((s) => `<th>${{ baby: '베이비', teen: '틴', awake: '각성' }[s]} 칸</th>`).join('')}<th>도트 묘사</th></tr></thead>
    <tbody>${g.rows.map((r) => `<tr class="${r.done ? 'done' : ''}">
      <td class="mk">${r.done ? '✓' : '○'}</td>
      <td class="sl">${SLOT_KO[r.slot]}</td>
      <td>${esc(r.ko)}</td>
      <td class="c">${esc(r.code)}</td>
      ${sts.map((s) => `<td class="c">${cells(r.tier, r.slot, s).join('×')}</td>`).join('')}
      <td class="d">${esc(r.desc)}</td></tr>`).join('')}
    </tbody>
  </table></div>
</section>`;
};

const html = `<title>슬라임 아이템 제작 작업표</title>
<style>
:root{
  --bg:#1e1c19; --surface:#262320; --line:#3a342c; --ink:#ece7de; --muted:#98917f;
  --accent:#f0a33c; --ok:#9BD468; --cool:#9cc4ec;
  --sans:"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,"Cascadia Mono",monospace;
  --pad:clamp(14px,3.5vw,36px);
}
@media (prefers-color-scheme:light){
  :root{ --bg:#f7f4ed; --surface:#fff; --line:#e5dfd2; --ink:#2b2721; --muted:#79725f;
         --accent:#b8720f; --ok:#3f7a2a; --cool:#3f6f9e; }
}
:root[data-theme="dark"]{ --bg:#1e1c19; --surface:#262320; --line:#3a342c; --ink:#ece7de;
  --muted:#98917f; --accent:#f0a33c; --ok:#9BD468; --cool:#9cc4ec; }
:root[data-theme="light"]{ --bg:#f7f4ed; --surface:#fff; --line:#e5dfd2; --ink:#2b2721;
  --muted:#79725f; --accent:#b8720f; --ok:#3f7a2a; --cool:#3f6f9e; }

body{ margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans);
      line-height:1.55; -webkit-text-size-adjust:100%; }
.wrap{ max-width:1120px; margin:0 auto; padding:var(--pad); }
header.top{ border-bottom:1px solid var(--line); }
.eyebrow{ font-family:var(--mono); font-size:11.5px; letter-spacing:.14em; text-transform:uppercase;
          color:var(--accent); margin:0 0 8px; }
h1{ font-size:clamp(24px,4.6vw,36px); line-height:1.2; margin:0 0 10px; letter-spacing:-.02em; font-weight:800; }
.lede{ margin:0; color:var(--muted); max-width:62ch; font-size:14px; }
.tally{ display:flex; flex-wrap:wrap; gap:7px; margin:18px 0 0; padding:0; list-style:none; }
.tally li{ font-family:var(--mono); font-size:12.5px; border:1px solid var(--line);
           border-radius:2px; padding:4px 9px; background:var(--surface); }
.tally b{ color:var(--accent); font-weight:700; }
.tally b.ok{ color:var(--ok); }

nav.f{ position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line); }
nav.f .wrap{ padding-top:10px; padding-bottom:10px; display:flex; flex-wrap:wrap; gap:7px; align-items:center; }
.chip{ font:inherit; font-size:13.5px; cursor:pointer; background:var(--surface); color:var(--ink);
       border:1px solid var(--line); border-radius:2px; padding:6px 12px; }
.chip[aria-pressed="true"]{ background:var(--accent); border-color:var(--accent); color:var(--bg); font-weight:700; }
.chip:focus-visible{ outline:2px solid var(--cool); outline-offset:2px; }

.grp{ margin-top:22px; }
.grp[hidden]{ display:none; }
.grp h3{ font-size:15.5px; margin:0 0 7px; display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.grp h3 b{ font-family:var(--mono); font-size:13px; color:var(--accent); }
.grp h3 b.ok{ color:var(--ok); }
.tier{ font-family:var(--mono); font-size:11px; font-weight:400; border-radius:2px; padding:1px 6px;
       border:1px solid currentColor; }
.t-legendary{ color:#e0574d; } .t-epic{ color:#c07be0; } .t-rare{ color:#6f9fe0; }
.t-magic{ color:#5fb8a8; } .t-normal{ color:var(--muted); }
.spec{ font-family:var(--mono); font-size:11px; color:var(--muted); }

.scroll{ overflow-x:auto; border:1px solid var(--line); border-radius:3px; background:var(--surface); }
table{ width:100%; border-collapse:collapse; font-size:13px; }
th{ text-align:left; font-family:var(--mono); font-size:10.5px; letter-spacing:.06em; text-transform:uppercase;
    color:var(--muted); font-weight:600; padding:7px 10px 6px; border-bottom:1px solid var(--line); white-space:nowrap; }
td{ padding:6px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }
tr:last-child td{ border-bottom:0; }
tr.done td{ opacity:.5; }
td.mk{ font-family:var(--mono); color:var(--muted); width:1em; }
tr.done td.mk{ color:var(--ok); opacity:1; font-weight:700; }
td.sl{ font-weight:700; }
td.c{ font-family:var(--mono); font-variant-numeric:tabular-nums; color:var(--muted); }
td.d{ color:var(--muted); white-space:normal; min-width:16ch; }

footer{ margin-top:36px; padding-top:18px; border-top:1px solid var(--line); color:var(--muted); font-size:12.5px; }
footer p{ margin:0 0 6px; max-width:64ch; }
code{ font-family:var(--mono); font-size:.94em; }
@media (prefers-reduced-motion:reduce){ *{ animation:none !important; transition:none !important; } }
</style>

<header class="top"><div class="wrap">
  <p class="eyebrow">유종의미 슬라임 · 시즌 0</p>
  <h1>제작 작업표</h1>
  <p class="lede">만들어야 할 것을 등급·세트별로 늘어놓고, 부위마다 <b>코드</b>와
    <b>그려 올 칸 수</b>를 적어 둔 것이다. 칸 수는 그 등급의 칸 크기와 덩치 배율까지
    반영된 값이라 <b>GPT 에 그대로 옮겨 적으면 된다</b>.</p>
  <p class="lede" style="margin-top:8px">전부 <b>${total}종</b> — 레전더리는 5세트를 만들어
    시즌0 에 2세트만 연다. 그래서 뽑기 풀은 103 종이고 나머지 15 종은 9월 픽업 대기다.
    <b>✓ 는 저장소 <code>items.json</code> 에 들어온 것</b>이라, 랩에만 담아 둔 것은
    「전부 복사 → 넘겨주기」 전까지 여기 안 뜬다.</p>
  <ul class="tally">
    <li>전체 <b class="${totalDone >= total ? 'ok' : ''}">${totalDone}</b>/${total}</li>
    ${['legendary', 'epic', 'rare', 'magic', 'normal'].filter((t) => stat[t]).map((t) =>
      `<li>${TIER_KO[t]} <b class="${stat[t].done >= stat[t].n ? 'ok' : ''}">${stat[t].done}</b>/${stat[t].n}</li>`).join('')}
  </ul>
</div></header>

<nav class="f"><div class="wrap">
  <button class="chip" aria-pressed="true" data-k="tier" data-f="all">전체</button>
  ${['legendary', 'epic', 'rare', 'magic', 'normal'].filter((t) => stat[t]).map((t) =>
    `<button class="chip" aria-pressed="false" data-k="tier" data-f="${t}">${TIER_KO[t]}</button>`).join('')}
  <span style="width:1px;height:20px;background:var(--line);margin:0 4px"></span>
  <button class="chip" aria-pressed="false" data-k="left" data-f="1">남은 것만</button>
</div></nav>

<main class="wrap">
  ${groups.map(card).join('')}
  <footer>
    <p><b>칸 수는 이미 환산된 값이다.</b> 에픽·레전더리는 한 칸이 1.5 라 같은 물건이
      칸 수로 두 배가 되고, 여기에 등급 덩치까지 곱해져 있다. 표에 적힌 숫자를 그대로
      주면 된다 — 규격서 §7 의 상자에서 칸 수 줄만 바꿔 넣으면 끝이다.</p>
    <p><b>매직 이상은 두 벌</b>(틴·각성)이다. 베이비는 노말만 착용한다.</p>
    <p>이 표는 <code>아이템카탈로그-v5.md</code> 와 <code>items.json</code> 에서 나온다.
      카탈로그를 고치거나 새로 담은 뒤 <code>작업표-만들기.mjs</code> 를 다시 돌리면 갱신된다.</p>
  </footer>
</main>

<script>
const chips = [...document.querySelectorAll('.chip')];
const grps = [...document.querySelectorAll('.grp')];
const pick = { tier: 'all', left: '0' };
chips.forEach((c) => c.addEventListener('click', () => {
  const k = c.dataset.k;
  if (k === 'left') { pick.left = pick.left === '1' ? '0' : '1'; c.setAttribute('aria-pressed', String(pick.left === '1')); }
  else { chips.filter((o) => o.dataset.k === 'tier').forEach((o) => o.setAttribute('aria-pressed', String(o === c))); pick.tier = c.dataset.f; }
  grps.forEach((g) => {
    g.hidden = (pick.tier !== 'all' && g.dataset.tier !== pick.tier)
            || (pick.left === '1' && g.dataset.left !== '1');
  });
}));
</script>
`;

const out = join(DIR, '작업표.html');
writeFileSync(out, html);
console.log(`작업표 — ${total}종 중 ${totalDone}종 담김 · 묶음 ${groups.length}개 → ${out}`);
