# 유종의미 국어학원 학생관리 앱 — 프로젝트 컨텍스트

_최종 갱신: 2026-07-29. 새 대화창에서 이 파일을 참고하면 바로 이어서 작업 가능._

## 개요
- Next.js 16(App Router, Turbopack) + Supabase(Postgres) + Vercel 배포.
- **실제 학생·학부모·조교가 매일 쓰는 프로덕션 앱** — 장난 삼아 부수는 실험 금지.
- 프로덕션 URL: `kaujm.vercel.app`. GitHub: `triplej1107/student-management-app`, `main` 브랜치에 push하면 Vercel 자동 배포.
- 4개 역할(학생/학부모/조교/종주T=원장)이 폰 폭 반응형 단일 코드베이스를 공유.
- `AGENTS.md`(=`CLAUDE.md`가 참조): 이 Next.js 16은 학습 데이터의 관례와 다를 수 있으니 `node_modules/next/dist/docs/`를 먼저 확인하라는 경고 있음.

## 현재 국면: 안정화 단계 (2026-07-29부터)
사용자가 신규 기능 추가를 멈추고 기존 기능 정비·버그 수정에 집중하기로 함 (2학기 시작 준비). 다만 사용자가 명시적으로 새 기능을 요청하면 그건 진행한다 (예: 이번 세션의 월간 보고서 기능). **내가 먼저 "이 김에 이것도 추가할까요" 제안하지 않기.**

## 작업 환경 / 워크플로우
- **로컬 CLI**(이 노트북)와 **claude.ai/code(웹)** 둘 다 연결 완료. GitHub App 인증 + `student-management-app`/`main` 연결 + 모든 시크릿을 웹의 "Default" 클라우드 환경에 등록해둠. 로컬 CLI 세션 기록과 웹 세션 기록은 서로 공유되지 않지만, 코드는 git으로 항상 동기화됨. 새 시크릿을 추가하면 `.env.local` + Vercel production env + claude.ai/code "Default" 환경 **3곳 모두** 등록해야 함.
- **DB 마이그레이션**: `supabase/migrations/NNNN_name.sql` 작성 → 사용자가 Supabase SQL Editor에서 직접 실행 → "성공" 확인받음 → 그제서야 스키마 의존 코드 배포. AI는 DDL을 직접 실행할 수 없음(service-role key로도 안 됨).
- **배포 전 스모크테스트 필수**: `npx next start -p <port>`로 로컬 프로덕션 빌드를 띄우고 (같은 프로덕션 Supabase DB를 바라봄) 브라우저로 직접 확인 후 push. 예전에 서버 컴포넌트에서 `"use client"` 파일의 상수를 `.map()`한 게 프로덕션 500 에러를 낸 적 있어서 생긴 습관.
- **테스트 계정**: 학생 로그인 `17882`(최지효), 종주T 비밀번호 `818283`(=`ADMIN_PASSWORD`). 스태프 테스트는 `__tmptest` 같은 임시 계정을 스크립트로 만들고 테스트 후 즉시 삭제.
- **PowerShell 파이프 BOM 버그**: `"val" | npx vercel env add ...`는 UTF-8 BOM으로 값이 오염됨. 반드시 **Bash tool**에서 `echo -n "val" | npx vercel env add ...` 사용.
- 브라우저 자동화로 로그인 폼 제출 시 `computer` 클릭이 잘 안 먹을 때가 있음 — `form_input`으로 값 채우고 `javascript_tool`로 `document.querySelector('form').requestSubmit()` 하는 게 안정적.

## 기술 스택
`@supabase/supabase-js`(service role key 전용, RLS는 전체 차단 후 서버 전용 접근으로 우회), `iron-session`(자체 세션, Supabase Auth 미사용), `bcryptjs`, `web-push`, `zod`, `fast-xml-parser`, 최근 추가된 `exceljs`(엑셀 생성) + `resend`(이메일 발송).

## 데이터 모델 핵심 테이블
`students`, `staff`, `attendance_records`, `makeup_schedules`, `clinic_templates`, `clinic_checks`, `notices`, `duty_items`/`duty_checks`, `class_plans`, `calendar_notes`, `clinic_contact_logs`, `school_exams`, `mock_exams`, `ujc_transactions`, `ujc_exchange_requests`.

- `clinic_checks`: (student_id, week_start) 1행. `hw_checks`(7슬롯 bool), `test_scores`(4슬롯), `staff_approved`/`zongju_approved`, `feedback_tags`/`feedback_text`(조교 AI 피드백), `zongju_feedback_text`(종주T 직접 작성, 별도 노출).
- UJC(유종코인): `ujc_transactions`가 원장, 잔액은 `SUM(amount)`로 매번 계산(캐시 컬럼 없음). 클리닉 완료 1개 적립은 **종주T 최종결재(zongju_approved=true) 시점에만** 발생 — 예전엔 조교 체크 시점에 잘못 적립되던 버그를 고침.

## 주요 파일 위치
- `src/lib/data.ts` — 대부분의 DB 접근 함수
- `src/lib/ujc.ts`, `src/lib/ujcTier.ts` — UJC 지갑/마켓/티어 계산
- `src/lib/monthlyReport.ts` — 월간 보고서 생성+발송
- `src/lib/weeks.ts`, `src/lib/types.ts` — 날짜 헬퍼, 전역 타입/상수
- `src/app/student`, `src/app/staff`, `src/app/admin` — 역할별 라우트
- `supabase/migrations/*.sql` — 현재 0015까지 적용됨

## 이번 세션에서 완료한 작업 (전부 배포+프로덕션 검증 완료)
1. UJC 적립 시점 버그 수정 — 조교 체크 시점 → 종주T 최종결재 시점으로. 프로덕션 데이터도 정정(잘못 적립 78건 회수, 누락 1건 지급, 71=71 확인).
2. 성적 백분위 "3명 중 1등" 조사 — 버그 아님. 예비고1반 12명 중 그 주 점수 입력된 게 3명뿐이었을 뿐, 데이터 채워지면 자동 반영.
3. UJC마켓 전체 구현 — GS25/구글플레이/올리브영 × 10/20/30 UJC, 신청 즉시 차감(Postgres RPC `request_ujc_exchange`로 원자적 처리), 관리자 발송대기/발송완료/취소환불 플로우, 사용자가 준 실제 브랜드 로고 이미지 적용(`public/brand/`).
4. 학생 홈 UJC 카드 축소 + 리더보드를 "UJC 보유량"(순위)과 "성실도 티어"(등급별 묶음) 2개 컬럼으로 분리.
5. 종주T 전용 피드백 필드 추가 — 작성했을 때만 학부모에게 특별하게 노출, 안 쓰면 아예 안 보임.
6. 조교 AI 피드백 프롬프트 수정 — 학생 대상 주체존대(-시-, -하셨-) 제거, 직전 피드백을 참고해 주차마다 표현 다양화. 기존 저장된 11건도 톤만 소급 수정(내용은 유지).
7. 피드백 태그 카테고리에 선택지 2개 추가("클리닉을 한번에 마치지 않고 미루는 습관" / "연락이 잘 안 됨") + "다 체크 안 해도 된다" 안내 문구.
8. 클리닉테스트 백분위 그래프에 산출 방식 설명 문구 추가.
9. **claude.ai/code 웹 버전 연결** — GitHub App 인증, 레포+`main` 브랜치 연결, 시크릿 전부 등록 완료. 이제 어느 기기에서든 브라우저로 claude.ai/code 들어가면 이 프로젝트 작업 이어갈 수 있음.
10. **월간 전체기록 보고서** — 종주T 화면에 "보고서" 탭 신설(`/admin/reports`). Resend로 이메일 발송, **학생 1명당 시트 1개**(출결→클리닉체크리스트→UJC내역→성적 순서로 그 학생의 한 달 이야기), 맨 앞 "전체 요약" 시트(학생별 집계 한 줄). 매달 1일 자동발송(Vercel Cron) + 관리자가 원하는 달을 즉시 받아볼 수 있는 버튼.

## 진행 중 / 열어둔 채로 끝난 항목
- **월간 보고서 구조**: 처음엔 카테고리별 플랫 시트로 만들었다가 "학생별로 봐야 한다"는 피드백을 받고 학생별 시트로 재구성함. 방금 새 버전을 다시 발송했고, 사용자의 추가 피드백 대기 중 — 재원생만 100명 넘어서 시트 탭이 너무 많아 찾기 불편하면 반별 그룹핑 등으로 조정 필요할 수 있음.

## 사용자 소통 스타일 / 선호
- 한국어 존댓말로 소통.
- 기능 배포는 로컬 스모크테스트 → 실제 프로덕션 확인까지 끝내고 나서 "배포 완료했습니다"로 보고. 중간 과정은 장황하게 설명하지 않음.
- DB 마이그레이션은 사용자가 직접 SQL Editor에서 실행 — AI가 대신 실행 못 한다고 매번 안내.
- 스코프를 임의로 줄이거나(예: 브랜드 로고를 텍스트 배지로 대체) 카테고리 배치를 임의로 정한 경우 반드시 먼저 언급해서 확인받기.
- 계정 생성, 유료 서비스 선택처럼 사용자만 결정할 수 있는 사안은 AskUserQuestion으로 확인 후 진행.
- 비밀번호/API 키 같은 자격증명 입력은 자동화 금지 — 화면을 열어주고 사용자가 직접 클릭/입력하게 안내 (GitHub OAuth 승인 등에서 실제로 클릭 자동화가 안전장치에 막힌 전례 있음).
