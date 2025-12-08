// frontend/src/lib/http.ts
import axios from "axios";

function getEnv(name: string): string | undefined {
  // Vite
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      // @ts-ignore
      const v = (import.meta as any).env[name];
      if (v) return String(v);
    }
  } catch {}
  // CRA / Node (only if it exists — avoids "process is not defined")
  try {
    if (typeof process !== "undefined" && (process as any).env) {
      const v = (process as any).env[name];
      if (v) return String(v);
    }
  } catch {}
  return undefined;
}

const raw =
  getEnv("VITE_API_BASE_URL") ||           // Vite
  getEnv("REACT_APP_URL") ||               // CRA (dev)
  "https://backend-2-4tjr.onrender.com"; // fallback

// keep protocol as provided; just remove trailing slash
const rawNoSlash = raw.replace(/\/$/, "");

// In Vite dev, prefer same-origin requests and use server.proxy unless overridden
let baseURL = rawNoSlash;
try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env: any = (import.meta as any).env;
    const useProxy = String(env.VITE_USE_PROXY ?? 'true').toLowerCase() !== 'false';
    if (env.DEV && useProxy) {
      baseURL = '';
    }
  }
} catch {}

export const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// helpful during setup
if (typeof window !== "undefined") {
  console.log("[http] baseURL =", http.defaults.baseURL);
}

export default http;
