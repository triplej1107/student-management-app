/**
 * 제출 후 보여줄 오답 정리 — 순수 계산만.
 *
 * 정답키는 제출 전에는 절대 학생 화면으로 내려보내지 않는다(정답을 미리
 * 볼 수 있게 된다). 그래서 이 계산은 반드시 서버에서 하고, 결과만
 * 화면으로 넘긴다.
 */

export interface WrongAnswer {
  /** 화면에 보여줄 문항 번호 (1부터) */
  number: number;
  correct: string;
  /** 학생이 고른 번호. 안 고르고 넘어갔으면 null. */
  chosen: string | null;
}

/** 화면 이탈로 자동 제출될 때 안 고른 문항은 "0"으로 채워진다. */
const UNMARKED = "0";

export function wrongAnswers(correct: string[], submitted: string[]): WrongAnswer[] {
  const wrong: WrongAnswer[] = [];
  for (let i = 0; i < correct.length; i++) {
    const chosen = submitted[i];
    if (chosen === correct[i]) continue;
    wrong.push({
      number: i + 1,
      correct: correct[i],
      chosen: !chosen || chosen === UNMARKED ? null : chosen,
    });
  }
  return wrong;
}

const CIRCLED = ["①", "②", "③", "④", "⑤"];

/** "3" → "③". 알 수 없는 값이면 그대로 보여준다. */
export function circled(choice: string | null): string {
  if (!choice) return "미표기";
  return CIRCLED[Number(choice) - 1] ?? choice;
}
