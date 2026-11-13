import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

/** Route parameter as a plain string. */
export const param = (req: Request, key = "id") => String(req.params[key] ?? "");

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  // Bad JSON or a body that is too large is the client's mistake, not a crash.
  const e = err as { expose?: boolean; status?: number };
  if (e?.expose && e.status && e.status < 500) return res.status(e.status).json({ error: "The request could not be read." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
}
