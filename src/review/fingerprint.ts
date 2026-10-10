// Feature 002 · data-model §2.1 — impressão do conteúdo do PR (rebase neutro, FR-007).
import { createHash } from "node:crypto";
import { FINGERPRINT_MAX_FILES } from "./catalog";
import type { CompareFile } from "./types";

const HUNK = /^@@ [^@]* @@.*$/gm;

/** sha256 dos patches normalizados, ou null quando a equivalência não é comprovável. */
export function patchFingerprint(files: CompareFile[]): string | null {
  if (files.length >= FINGERPRINT_MAX_FILES) return null;
  if (files.some((f) => typeof f.patch !== "string")) return null;
  const parts = [...files]
    .sort((a, b) => (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0))
    .map((f) =>
      [f.status, f.filename, f.previous_filename ?? "", f.patch!.replace(HUNK, "@@")].join("\n"),
    );
  return createHash("sha256").update(parts.join("\n\u0000\n")).digest("hex");
}
