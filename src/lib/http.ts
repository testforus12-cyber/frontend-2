// src/lib/http.ts
import axios from "axios";

function getEnv(name: string): string | undefined {
  try {
    // Vite
    // @ts-ignore
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      // @ts-ignore
      const v = (import.meta as any).env[name];
      if (v) return String(v);
    }
  } catch {}
  try {
    // Node/process fallback (rare in browser)
    if (typeof process !== "undefined" && (process as any).env) {
      const v = (process as any).env[name];
      if (v) return String(v);
    }
  } catch {}
  return undefined;
}

// Preferred env name (compatible with earlier advice)
const configured =
  getEnv("VITE_API_BASE") ||
  getEnv("VITE_API_BASE_URL") || // keep backward-compat
  getEnv("REACT_APP_URL") ||     // older CRA name
  "https://backend-2-4tjr.onrender.com"; // final fallback

const rawNoSlash = String(configured).replace(/\/$/, "");

// Decide whether to use proxy in dev:
// - Default: DO NOT use proxy (baseURL will be the deployed backend).
// - If you explicitly want proxying during dev, set VITE_USE_PROXY=true in your .env
let baseURL = rawNoSlash;
try {
  // @ts-ignore
  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    const env: any = (import.meta as any).env;
    const useProxy = String(env.VITE_USE_PROXY ?? "false").toLowerCase() === "true";
    // Only set baseURL = '' if developer explicitly opts into proxying
    if (env.DEV && useProxy) {
      baseURL = "";
    }
  }
} catch (e) {
  // ignore and use rawNoSlash
}

// Configure axios - set withCredentials to true only if you use cookies for auth
const http = axios.create({
  baseURL,
  withCredentials: false,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

// Helpful log to confirm what is being used at runtime
if (typeof window !== "undefined") {
  console.log("[http] baseURL =", http.defaults.baseURL);
}

export default http;
