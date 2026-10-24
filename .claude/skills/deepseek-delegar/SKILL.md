---
name: deepseek-delegar
description: Optional team workflow for coding, only when ~/.deepseek-key exists on this machine. DeepSeek Flash (cheap and fast) writes the simple pieces, and Claude reviews and corrects its output and writes the complex pieces itself. Use it on coding tasks in this repo: split the work, delegate boilerplate, single functions, small components, CRUD endpoints, data conversions, unit tests, CSS/HTML, config files and simple scripts; keep architecture, core logic, debugging, integration and security-sensitive code.
---

# Delegar a DeepSeek

DeepSeek Flash acts as a junior programmer. You (Claude) are the senior lead. First check that
`~/.deepseek-key` exists (or `DEEPSEEK_API_KEY` is set); if not, skip this skill and code normally.
Your user can turn it on by saving their own DeepSeek or OpenRouter key there; never commit a key.
When the key exists, apply this division of labor on coding tasks:
- **Flash writes the simple code.**
- **You correct Flash's output and write the complex code yourself.**

## Workflow for each coding task
1. Plan the change and split it into pieces: simple pieces go to Flash, complex pieces stay with you.
2. Send the simple pieces to Flash first (in parallel when independent), with precise briefs.
   Define the interfaces (function signatures, data shapes) yourself so the pieces fit together.
3. While Flash works, or right after, write the complex pieces yourself.
4. Review and correct everything Flash returned, then run tests or the app on the whole result.

## What goes where
- Flash: the piece fits in 1–3 files, the expected result is obvious, and you could describe it in a few lines.
  Typical examples: boilerplate, UI components and CSS, CRUD endpoints, forms, data conversions, simple
  helpers, unit tests, config files, seed data, small scripts.
- You: architecture and interfaces, core logic and tricky algorithms, debugging, integration between
  pieces, anything touching auth/secrets/payments, cross-cutting refactors, and anything where
  explaining the context would take longer than writing the code.
- If Flash fails twice on the same piece, stop re-delegating and write it yourself.

## How to call it
The script lives next to this file. Run it from the project root:

```bash
node ~/.claude/skills/deepseek-delegar/ds.mjs --task "<precise brief>" --files <context files> --write
```

- `--files`: pass the files it must read or modify (it returns them complete). Pass only what is needed.
- `--write`: writes the returned files under the current folder (it refuses paths outside it). Omit it to only see the answer.
- `--model pro`: slower but smarter, for a tricky algorithm. Default is `fast`.
  With an OpenRouter key these are `~deepseek/deepseek-flash-latest` and `~deepseek/deepseek-pro-latest` (always the newest flash/pro);
  with a DeepSeek key, `deepseek-chat` and `deepseek-reasoner`. A full model id also works.
- Long briefs: pipe them through stdin (`cat brief.txt | node .../ds.mjs --write`).
- Independent tasks can run in parallel (several Bash calls in the same message).

## Writing the brief
Include: file path(s) to create/modify, language and framework, function signatures or props,
expected inputs/outputs, edge cases, and "do not touch anything else". Example:

> Create `src/utils/format.ts` exporting `formatMXN(cents: number): string` that returns e.g. "$1,234.50 MXN".
> Negative values as "-$5.00 MXN". No dependencies. Also create `src/utils/format.test.ts` with vitest tests.

## After it answers (mandatory)
1. Check `git diff` / read the written files. DeepSeek can rewrite parts of a context file it should not touch.
2. Run the tests, linter or the app. If it fails, either fix small issues yourself or re-delegate with the error message.
3. Tell the user briefly which pieces were written by DeepSeek.

## Setup
Needs Node 18+ and a key in the `DEEPSEEK_API_KEY` env var or in `~/.deepseek-key` (never inside a repo).
The key can be from DeepSeek (https://platform.deepseek.com/api_keys) or OpenRouter (`sk-or-...`); the script picks the endpoint from the prefix.
