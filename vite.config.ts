import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  base: "/",
  plugins: [svelte({ preprocess: vitePreprocess() })],
  test: { include: ["shared/**/*.test.ts"] },
} as any);
