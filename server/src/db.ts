import "./env.ts";
import { resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../prisma/generated/prisma/client.ts";

const url = process.env.DATABASE_URL!;
if (!url.startsWith("file:")) throw new Error("DATABASE_URL must be a SQLite file, for example file:./dev.db");
const file = resolve(process.cwd(), "server/prisma", url.slice("file:".length));

export const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });

/** Records who did what, kept as testing evidence. */
export const logActivity = (action: string, detail: string) =>
  prisma.activity.create({ data: { action, detail } }).catch((e) => console.error("[activity]", e));
