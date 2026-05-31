import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Widened from "src/core/**" so game-layer tests (Zustand store actions)
    // colocate under src/game/__tests__/ instead of being pulled into core.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
