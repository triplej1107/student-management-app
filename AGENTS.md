<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 이 프로젝트에서 일할 때

- 새 대화창이면 **`PROJECT_CONTEXT.md`를 먼저 읽는다.** 지금까지의 맥락과
  진행 중인 작업이 거기 정리돼 있다.
- 다음에 할 일이 정해져 있으면 `docs/`에 작업지시 문서가 있다. 원장님이
  "○○ 시작하자"라고만 말하면 그 문서를 처음부터 끝까지 따라가면 된다.
- DB 마이그레이션은 AI가 실행할 수 없다. `supabase/migrations/`에 SQL을
  쓰고, 원장님이 Supabase SQL Editor에서 직접 돌린 뒤 "성공"을 확인받고
  나서야 스키마에 의존하는 코드를 배포한다. 적용 여부는
  `supabase/migrations/APPLIED.md`에 기록한다.
- 비밀번호·API 키 입력은 자동화하지 않는다. 화면만 열어주고 원장님이 직접
  입력하게 안내한다.
