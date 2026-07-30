"use client";

import { useState } from "react";
import { PushOptInModal } from "./PushOptInModal";

/** 종주T 로그인 시 뜨는 모달 — 학부모 질문 알림을 받기 위한 알림 켜기 유도. */
export function AdminHomeModals() {
  const [pushDone, setPushDone] = useState(false);

  if (!pushDone) {
    return (
      <PushOptInModal
        onDone={() => setPushDone(true)}
        bodyText="학부모가 질문을 남기면 알림으로 알려드려요."
      />
    );
  }

  return null;
}
