// Copies ../backend/mocks/*.json into public/demo/ for the offline demo fallback. Read-only on the backend side.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, "..", "backend", "mocks");
const to = join(root, "public", "demo");

mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((f) => f.endsWith(".json"));
for (const f of files) copyFileSync(join(from, f), join(to, f));
console.log(`Copied ${files.length} files to public/demo: ${files.join(", ")}`);
