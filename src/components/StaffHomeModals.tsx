"use client";

import { useState } from "react";
import { StaffFeedbackModal } from "./StaffFeedbackModal";
import { PushOptInModal } from "./PushOptInModal";
import type { StaffFeedbackMessage } from "@/lib/staffFeedback";

/** 조교 로그인 시 뜰 수 있는 모달 — 종주T 한마디(안 본 것이 있으면) →
 * 알림 켜기 유도 순서로 하나씩만 보여준다. */
export function StaffHomeModals({
  feedback,
  markSeenAction,
}: {
  feedback: StaffFeedbackMessage[];
  markSeenAction: (ids: number[]) => Promise<void>;
}) {
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  if (feedback.length > 0 && !feedbackDone) {
    return (
      <StaffFeedbackModal
        messages={feedback}
        markSeenAction={markSeenAction}
        onDismiss={() => setFeedbackDone(true)}
      />
    );
  }

  if (!pushDone) {
    return <PushOptInModal onDone={() => setPushDone(true)} />;
  }

  return null;
}
