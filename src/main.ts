import "./style.css";
import App from "./App.svelte";
new App({ target: document.getElementById("app")! });
// Service worker: caches the app for fast reopening and receives push notifications.
if ("serviceWorker" in navigator) window.addEventListener("load", () => { navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js", { scope: import.meta.env.BASE_URL }).catch(() => {}); });
