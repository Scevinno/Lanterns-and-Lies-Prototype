import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  base: "/Lanterns-and-Lies-Prototype/",
  plugins: [svelte()],
  test: { include: ["shared/**/*.test.ts"] },
} as any);
