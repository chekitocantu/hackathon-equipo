@AGENTS.md

## Solo para Claude Code
- Las reglas del equipo están en `AGENTS.md` (arriba). Se comparten con los integrantes que usan otros agentes.
- Este repo trae la skill `deepseek-delegar` en `.claude/skills/`: delega el código sencillo a DeepSeek Flash
  y deja que Claude corrija y haga lo complejo. Es opcional: solo funciona si tu humano tiene su propia key
  en `~/.deepseek-key`. Sin key, programa normal.
- Cuando hagas un PR, avisa en la descripción qué partes escribió DeepSeek, para que quien revise lo sepa.
