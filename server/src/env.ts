import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load server/.env (built into Node 21.7+) before anything reads process.env.
const envPath = resolve(process.cwd(), "server/.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Copy server/.env.example to server/.env.");

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4100),
  isProd: process.env.NODE_ENV === "production",
  allowedHosts: list(process.env.ALLOWED_HOSTS),
  ai: {
    baseUrl: (process.env.AI_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL ?? "llama3.2:3b",
    apiKey: process.env.AI_API_KEY?.trim() || undefined,
  },
  nmapPath: process.env.NMAP_PATH?.trim() || "nmap",
  zapPath: process.env.ZAP_PATH?.trim() || "",
  javaPath: process.env.JAVA_PATH?.trim() || "",
};
