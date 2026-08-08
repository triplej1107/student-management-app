import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Vercel 서버가 UTC로 도는 것과 같은 조건에서 돌려야, 한국 시간 자정~9시
    // 사이에만 드러나는 날짜 오차를 테스트가 실제로 잡아낸다.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // `import "server-only"`는 클라이언트 번들에서 일부러 터지는 표시일 뿐이라
      // 테스트에서는 빈 모듈로 바꾼다. 안 그러면 서버 전용 파일(macgai7.ts 등)을
      // 아예 불러올 수가 없어 네트워크 흐름을 시험할 방법이 없다.
      "server-only": path.resolve(import.meta.dirname, "./src/test/serverOnlyStub.ts"),
    },
  },
});
