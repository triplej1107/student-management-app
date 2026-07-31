import "server-only";

/** Vercel은 배포된 환경(Production/Preview)에만 VERCEL_ENV를 심어준다 —
 * 로컬 `next dev`/`next start`에는 없다. 학생 전체를 훑어 실제 DB에 쓰고
 * 푸시까지 보내는 자동화 로직(자동 지각/결석)이 로컬 테스트 중 실수로
 * 운영 데이터에 영향을 주지 않도록 이 신호로 막는다. */
export function isDeployedEnvironment(): boolean {
  return !!process.env.VERCEL_ENV;
}
