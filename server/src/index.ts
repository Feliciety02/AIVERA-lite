import "./env.ts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import helmet from "helmet";
import { env } from "./env.ts";
import { api } from "./routes.ts";
import { errorHandler } from "./http.ts";
import { failInterruptedScans } from "./scanner.ts";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use("/api", api);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// In production the built website (npm run build) is served from the same server.
const dist = resolve(process.cwd(), "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
}

app.use(errorHandler);

await failInterruptedScans();
app.listen(env.port, () => console.log(`AIVERA Lite API on http://localhost:${env.port}`));
