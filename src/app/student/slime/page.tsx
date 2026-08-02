import Link from "next/link";
import { requireStudentSession } from "@/lib/authz";
import { getLiveSeason, getOrCreateSlime } from "@/lib/slimeXp";
import { getEquippedCodes, getShardBalance, getTicketBalance, listInventory } from "@/lib/slimeGacha";
import { getUjcBalance } from "@/lib/ujc";
import { ATTR_LABELS, STAGE_LABELS, type SlimeAttr, type SlimeEquip, type SlimeStage } from "@/lib/slimeSprite";
import { SlimeIdle } from "@/components/SlimeIdle";
import { SlimeSprite } from "@/components/SlimeSprite";
import { SlimeGachaPanel } from "@/components/SlimeGachaPanel";
import { SlimeInventory } from "@/components/SlimeInventory";
import { BackButton } from "@/components/BackButton";

/** 내 슬라임 — 살아있는 슬라임 + 성장 진행 + 뽑기 + 인벤토리.
 * 시즌 시작(2026-08-22) 전에는 티저만 보여준다 (홈 카드도 그 전엔 숨김). */
export default async function StudentSlimePage() {
  const session = await requireStudentSession();
  const isStudent = session.role === "student";

  const season = await getLiveSeason();
  if (!season) {
    return (
      <div className="box-border px-5 pt-2 pb-6">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold text-ink">내 슬라임</div>
          <BackButton href="/student" />
        </div>
        <div className="mt-10 text-center">
          <SlimeSprite attr="water" stage="egg" width={140} />
          <div className="mt-4 text-sm font-bold text-ink">8월 22일, 알이 도착합니다</div>
          <div className="mt-1 text-xs text-ink-muted">2학기 개강과 함께 슬라임 키우기가 시작돼요.</div>
        </div>
      </div>
    );
  }

  const slime = await getOrCreateSlime(session.studentId, season);
  if (!slime) {
    return (
      <div className="box-border px-5 pt-6 text-center text-sm text-ink-muted">
        슬라임을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
      </div>
    );
  }

  const stage = (slime.stage === "job" ? "awake" : slime.stage) as SlimeStage;
  const attr = (slime.attribute ?? "water") as SlimeAttr;
  const equippedCodes = stage === "egg" ? {} : await getEquippedCodes(slime.id);
  const equip: SlimeEquip = {
    weapon: equippedCodes.weapon,
    shield: equippedCodes.shield,
    hat: equippedCodes.hat,
    eyewear: equippedCodes.eyewear,
  };

  const [ujc, tickets, shards, inventory] = await Promise.all([
    isStudent ? getUjcBalance(session.studentId) : Promise.resolve(0),
    getTicketBalance(session.studentId),
    getShardBalance(session.studentId),
    listInventory(session.studentId),
  ]);

  const th = season.evolve_thresholds;
  const nextInfo =
    slime.stage === "egg"
      ? { target: th.hatch, label: "부화까지" }
      : slime.stage === "baby"
        ? { target: th.teen, label: "틴 진화까지" }
        : slime.stage === "teen"
          ? { target: th.awake, label: "각성까지" }
          : slime.stage === "awake"
            ? { target: th.job, label: "전직 준비까지" }
            : null;
  const pct = nextInfo ? Math.min(100, Math.round((slime.xp / nextInfo.target) * 100)) : 100;

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <div className="flex items-center justify-between">
        <div className="text-xl font-extrabold text-ink">내 슬라임</div>
        <BackButton href="/student" />
      </div>

      <div className="mt-4 rounded-2xl border border-line-soft bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink">
            {STAGE_LABELS[slime.stage]}
            {slime.attribute && (
              <span className="ml-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                {ATTR_LABELS[attr]}
              </span>
            )}
          </div>
          <div className="text-xs font-bold text-ink-muted">XP {slime.xp.toLocaleString()}</div>
        </div>

        <SlimeIdle attr={attr} stage={stage} width={130} stageHeight={150} equip={equip} />

        {slime.stage === "egg" && (
          <div className="mt-1 text-center text-xs text-ink-muted">
            클리닉에 출석하면 알이 자라요 — 부화하면 어떤 속성일까요?
          </div>
        )}

        {nextInfo && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-ink-muted">
              <span>{nextInfo.label}</span>
              <span>
                {slime.xp.toLocaleString()} / {nextInfo.target.toLocaleString()}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line-soft">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {isStudent && (
        <div className="mt-4">
          <SlimeGachaPanel ujc={ujc} tickets={tickets} shards={shards} />
        </div>
      )}

      <div className="mt-4">
        <SlimeInventory items={inventory} equipped={equippedCodes} />
      </div>

      <div className="mt-4 text-center text-[11px] leading-relaxed text-ink-muted">
        XP는 클리닉 출석·숙제·테스트에서 자동으로 쌓여요.
        <br />
        개근을 이어가면 보너스 배율이 붙고, 오래 다닐수록 더 빨리 자라요.
      </div>

      <Link href="/student" className="mt-4 block text-center text-xs font-bold text-accent">
        홈으로 →
      </Link>
    </div>
  );
}
