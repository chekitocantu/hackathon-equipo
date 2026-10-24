#!/usr/bin/env node
// Delegates a simple coding task to DeepSeek and (optionally) writes the files it returns.
// No dependencies: Node 18+ (native fetch).
//
// Usage:
//   node ds.mjs --task "Create utils/slug.js with a slugify(str) function" [--files a.js b.js] [--write] [--dir .]
//   echo "task" | node ds.mjs --write
// Options:
//   --task <text>     Task description (or pipe it through stdin)
//   --files <paths>   Context files sent to DeepSeek (existing code to read or modify)
//   --write           Write the returned files to disk (otherwise just print the answer)
//   --dir <path>      Base folder for --write (default: current folder)
//   --model <name>    fast (default) | pro (slower, smarter) | any full model id
// Key: DEEPSEEK_API_KEY env var, or a file at ~/.deepseek-key. A DeepSeek key or an OpenRouter key (sk-or-...).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const opt = { files: [], write: false, dir: ".", model: process.env.DEEPSEEK_MODEL || "fast" };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--task") opt.task = args[++i];
  else if (a === "--write") opt.write = true;
  else if (a === "--dir") opt.dir = args[++i];
  else if (a === "--model") opt.model = args[++i];
  else if (a === "--files") while (args[i + 1] && !args[i + 1].startsWith("--")) opt.files.push(args[++i]);
  else { console.error(`Unknown argument: ${a}`); process.exit(2); }
}

if (!opt.task && !process.stdin.isTTY) opt.task = fs.readFileSync(0, "utf8").trim();
if (!opt.task) { console.error("Missing --task"); process.exit(2); }

const keyFile = path.join(os.homedir(), ".deepseek-key");
const key = process.env.DEEPSEEK_API_KEY || (fs.existsSync(keyFile) && fs.readFileSync(keyFile, "utf8").trim());
if (!key) { console.error(`No API key: set DEEPSEEK_API_KEY or create ${keyFile}`); process.exit(2); }
if (key.length < 20 || key.includes("...")) { console.error(`API key looks like a placeholder (${key.length} chars). Put the real key in ${keyFile}`); process.exit(2); }

// OpenRouter keys (sk-or-...) go through OpenRouter; anything else goes to DeepSeek directly.
const openrouter = key.startsWith("sk-or-");
const url = openrouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
const aliases = openrouter
  ? { fast: "~deepseek/deepseek-flash-latest", pro: "~deepseek/deepseek-pro-latest" } // auto-follow newest versions
  : { fast: "deepseek-chat", pro: "deepseek-reasoner" };
opt.model = aliases[opt.model] || opt.model;

const SYSTEM = `You are a precise junior programmer. You receive a small, well-defined coding task.
Rules:
- Return every file you create or change COMPLETE (never partial snippets or "..." placeholders).
- Use exactly this format for each file, with paths relative to the project root:
=== FILE: path/to/file.ext ===
<full file content>
=== END ===
- After the files, add at most 3 short lines under "NOTES:" (assumptions, how to run). Nothing else.
- Match the style of the context files. No new dependencies unless the task asks for them.`;

let user = `TASK:\n${opt.task}\n`;
for (const f of opt.files) {
  user += `\n=== CONTEXT FILE: ${f.replace(/\\/g, "/")} ===\n${fs.readFileSync(f, "utf8")}\n=== END ===\n`;
}

const t0 = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model: opt.model,
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    temperature: 0,
    max_tokens: 8000,
  }),
});
if (!res.ok) { console.error(`DeepSeek error ${res.status}: ${await res.text()}`); process.exit(1); }
const data = await res.json();
const out = data.choices[0].message.content;
const u = data.usage || {};
const stats = `[deepseek ${data.model || opt.model} | ${((Date.now() - t0) / 1000).toFixed(1)}s | in ${u.prompt_tokens} / out ${u.completion_tokens} tokens]`;

if (!opt.write) { console.log(out); console.log(stats); process.exit(0); }

const base = path.resolve(opt.dir);
const re = /=== FILE: (.+?) ===\r?\n([\s\S]*?)\r?\n=== END ===/g;
let m, n = 0;
while ((m = re.exec(out))) {
  const target = path.resolve(base, m[1].trim());
  if (!target.startsWith(base + path.sep)) { console.error(`Skipped (outside --dir): ${m[1]}`); continue; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, m[2].endsWith("\n") ? m[2] : m[2] + "\n");
  console.log(`wrote ${path.relative(base, target)}`);
  n++;
}
if (!n) { console.log("No files found in the answer. Raw output:\n" + out); }
// Notes come after the last file block, so "NOTES:" inside a written file is ignored.
const tail = out.slice(out.lastIndexOf("=== END ===") + 11);
const notes = tail.split("NOTES:")[1];
if (notes) console.log("NOTES:" + notes.trimEnd());
console.log(stats);
