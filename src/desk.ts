// Desktop layout (Nik, 14 Nov): browser and Steam players on a wide screen with a mouse get their own layout.
// Phones and tablets are touch-first, so they never match and keep the phone layout exactly as it is.
import { readable } from "svelte/store";

const QUERY = "(min-width: 1100px) and (hover: hover) and (pointer: fine)";
const mq = typeof matchMedia === "function" ? matchMedia(QUERY) : null;
const apply = () => document.documentElement.classList.toggle("desk", !!mq?.matches);
apply(); // set before the first paint, so the phone layout never flashes on a desktop

export const desk = readable(!!mq?.matches, (set) => {
  if (!mq) return;
  const on = () => { apply(); set(mq.matches); };
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
});
