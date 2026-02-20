import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const ALLOWED_EXT = new Set([".js", ".css", ".html"]);
const suspiciousPatterns = [
  { name: "replacement-char", re: /\uFFFD/u },
  { name: "utf8-latin1-pair", re: /[ÐÑ][\u0080-\u00BF]/u },
  { name: "latin1-leading", re: /[ÂÃ][\u0080-\u00BF]/u },
  { name: "mojibake-seq-ru", re: /Р[А-Яа-яЁё]С[А-Яа-яЁё]/u },
  { name: "mojibake-seq-win", re: /вЂ[^\s]/u }
];
const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!ALLOWED_EXT.has(extname(full))) continue;
    const text = readFileSync(full, "utf8");
    for (const { name, re } of suspiciousPatterns) {
      if (re.test(text)) {
        problems.push(`${full}: ${name}`);
        break;
      }
    }
  }
}

walk(SRC);

if (problems.length) {
  console.error("Potential mojibake detected:");
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log("OK: mojibake patterns not found");
