import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const JS_EXT = new Set([".js", ".mjs"]);
const RE_NATIVE_DIALOG = /\b(?:alert|prompt|confirm)\s*\(/g;
const errors = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!JS_EXT.has(extname(full))) continue;
    const text = readFileSync(full, "utf8");
    const match = text.match(RE_NATIVE_DIALOG);
    if (match?.length) errors.push(`${full}: found native dialog call(s)`);
  }
}

walk(SRC);

if (errors.length) {
  console.error("Native dialogs are forbidden in src/:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log("OK: no native alert/prompt/confirm calls in src/");
