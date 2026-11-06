import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  base: "/Lanterns-and-Lies-Prototype/",
  plugins: [svelte({ preprocess: vitePreprocess() })],
  test: { include: ["shared/**/*.test.ts"] },
} as any);
