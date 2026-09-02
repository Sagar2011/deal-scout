import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";
import { randomBytes } from "node:crypto";
import type { RunContext } from "./models.js";

export async function createRun(rootDir: string, topic: string): Promise<RunContext> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "").replace("T", "-");
  const id = `${timestamp}-${randomBytes(3).toString("hex")}`;
  const path = join(rootDir, id);
  await mkdir(path, { recursive: true });
  await writeJson({ id, path }, "input.json", { topic, createdAt: now.toISOString() });
  return { id, path };
}

export async function writeJson(run: RunContext, relativePath: string, value: unknown): Promise<void> {
  await writeText(run, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(run: RunContext, relativePath: string, value: string): Promise<void> {
  const target = normalize(relativePath);
  if (isAbsolute(target) || target.startsWith("..")) throw new Error("Artifact path must stay inside the run directory");
  const path = join(run.path, target);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, value, "utf8");
}
