import { requireZongjuSession } from "@/lib/authz";
import { listQuestPresets, listRecentQuests } from "@/lib/quests";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { QuestManager } from "@/components/admin/QuestManager";
import { STAFF_SUB_TABS } from "../subTabs";

export default async function AdminQuestsPage() {
  await requireZongjuSession();
  const [presets, recent] = await Promise.all([listQuestPresets(), listRecentQuests()]);

  return (
    <div>
      <AdminSubNav tabs={STAFF_SUB_TABS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">돌발퀘스트</div>
      <div className="mt-1 mb-3.5 text-xs text-ink-muted">
        평소 업무 외에 갑자기 부탁할 일을 조교 화면에 바로 띄워요. 조교가 완료를 누르면 종주T 홈에
        올라옵니다.
      </div>

      <QuestManager presets={presets} recent={recent} />
    </div>
  );
}
