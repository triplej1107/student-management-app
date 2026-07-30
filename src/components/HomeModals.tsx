"use client";

import { useState } from "react";
import { BirthdayModal } from "./BirthdayModal";
import { BacklogWarningModal } from "./BacklogWarningModal";
import { PushOptInModal } from "./PushOptInModal";

interface BacklogData {
  weeksOverdue: number;
  oldestIncompleteLabel: string;
  missingHwLabels: string[];
  missingTestLabels: string[];
}

/** 로그인 시 뜰 수 있는 모달들을 우선순위대로 하나씩만 보여준다 —
 * 생일 축하 → 클리닉 밀림 경고 → 알림 켜기 유도 순서. */
export function HomeModals({
  birthdayName,
  backlog,
  showPushPrompt,
}: {
  birthdayName?: string | null;
  backlog?: BacklogData | null;
  showPushPrompt: boolean;
}) {
  const [birthdayDone, setBirthdayDone] = useState(false);
  const [backlogDone, setBacklogDone] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  if (birthdayName && !birthdayDone) {
    return <BirthdayModal studentName={birthdayName} onDismiss={() => setBirthdayDone(true)} />;
  }

  if (backlog && !backlogDone) {
    return (
      <BacklogWarningModal
        weeksOverdue={backlog.weeksOverdue}
        oldestIncompleteLabel={backlog.oldestIncompleteLabel}
        missingHwLabels={backlog.missingHwLabels}
        missingTestLabels={backlog.missingTestLabels}
        onDismiss={() => setBacklogDone(true)}
      />
    );
  }

  if (showPushPrompt && !pushDone) {
    return <PushOptInModal onDone={() => setPushDone(true)} />;
  }

  return null;
}
