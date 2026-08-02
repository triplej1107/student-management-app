import { requireZongjuSession } from "@/lib/authz";
import { SlimeSprite } from "@/components/SlimeSprite";
import { SlimeIdle } from "@/components/SlimeIdle";
import { SLIME_ATTRS, ATTR_LABELS, type SlimeStage } from "@/lib/slimeSprite";

const STAGES: { key: SlimeStage; label: string }[] = [
  { key: "baby", label: "베이비" },
  { key: "teen", label: "틴" },
  { key: "awake", label: "각성" },
];

/**
 * 종주T 전용 슬라임 렌더러 미리보기 — 학생 화면에는 아직 노출되지 않는다
 * (게임은 2026-08-22 공개). 네비게이션에도 없는 숨은 페이지: /admin/slime-preview
 */
export default async function SlimePreviewPage() {
  await requireZongjuSession();

  return (
    <div>
      <div className="mt-4 text-xl font-extrabold text-ink">슬라임 렌더러 미리보기</div>
      <div className="mt-1 text-xs text-ink-muted">
        확정 스펙 v3 (game-design/slime-design.v3.json) — 앱 렌더러 이식 확인용. 학생에게는 8/22 공개 전까지 보이지 않아요.
      </div>

      <div className="mt-5 rounded-2xl border border-line-soft bg-white p-4">
        <div className="mb-1 text-sm font-bold text-ink">살아있는 슬라임 (행동 데모)</div>
        <div className="mb-2 text-xs text-ink-muted">
          몇 초마다 랜덤 행동: 통통 이동 / 웃기 / 하품 / 훌쩍 / 졸기 — 학생 홈에 이 컴포넌트가 들어갑니다.
        </div>
        <SlimeIdle attr="water" stage="teen" width={120} />
      </div>

      <div className="mt-4 rounded-2xl border border-line-soft bg-white p-4 text-center">
        <div className="mb-2 text-sm font-bold text-ink">알 (부화 전 — 속성 비공개)</div>
        <SlimeSprite attr="water" stage="egg" width={120} />
      </div>

      {STAGES.map((s) => (
        <div key={s.key} className="mt-4 rounded-2xl border border-line-soft bg-white p-4">
          <div className="mb-2 text-sm font-bold text-ink">{s.label}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {SLIME_ATTRS.map((a) => (
              <div key={a} className="text-center">
                <SlimeSprite attr={a} stage={s.key} width={104} />
                <div className="text-[11px] text-ink-muted">{ATTR_LABELS[a]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
