/**
 * 돌발퀘스트가 지금 어느 단계인지 — 순수 계산만.
 *
 * "명령"이라는 말 대신 "요청"으로 쓴다. 화면 문구도 마찬가지.
 */

export interface QuestTimestamps {
  acked_at: string | null;
  done_at: string | null;
  feedback: string | null;
  reviewed_at: string | null;
  feedback_seen_at: string | null;
}

export type QuestStage =
  /** 보냈고 조교가 아직 확인 전 — 조교 화면에 팝업까지 띄운다 */
  | "sent"
  /** 조교가 확인함, 아직 하는 중 */
  | "acked"
  /** 조교가 끝냄 — 종주T가 볼 차례 */
  | "done"
  /** 종주T가 피드백을 남김 — 조교가 읽을 차례 */
  | "feedback"
  /** 다 끝나서 아무 화면에도 안 뜬다 */
  | "closed";

export function questStage(q: QuestTimestamps): QuestStage {
  if (q.feedback_seen_at) return "closed";
  if (q.reviewed_at) {
    // 피드백 없이 확인만 눌렀으면 조교 화면에 아무것도 띄우지 않는다.
    return q.feedback?.trim() ? "feedback" : "closed";
  }
  if (q.done_at) return "done";
  if (q.acked_at) return "acked";
  return "sent";
}

/** 조교 홈에 한 줄로 뜨는 것들. */
export function isStaffVisible(stage: QuestStage): boolean {
  return stage === "sent" || stage === "acked" || stage === "feedback";
}

/** 종주T 홈에 "완료됐어요"로 뜨는 것들. */
export function isZongjuVisible(stage: QuestStage): boolean {
  return stage === "done";
}
