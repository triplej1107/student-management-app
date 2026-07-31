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
    },
  },
});
