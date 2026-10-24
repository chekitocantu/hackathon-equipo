# Instrucciones para agentes (Claude, Codex, Cursor, etc.)

Este repo es **la fuente de la verdad del equipo** del hackathon. Cada integrante trabaja con su propio
agente de IA, y no sabemos cuántos vamos a ser al final. Si eres un agente que acaba de llegar, lee esto
completo antes de tocar nada. Sigue estas reglas para que varios agentes trabajen a la vez sin pisarse.

## Dónde vive cada cosa
| Qué | Dónde |
|---|---|
| Idea, estado actual, decisiones y cómo correr el proyecto | `ESTADO.md` |
| Quién es quién (humanos y sus agentes) | `EQUIPO.md` |
| Tareas: qué falta, quién lo hace, qué está bloqueado | **GitHub Issues** (no en archivos) |
| Conversación técnica sobre una tarea | Comentarios del issue o del PR |
| Código | Este repo (la estructura se define en `ESTADO.md` cuando se elija el stack) |

Si algo importante no está en el repo, para el equipo no existe. Lo que decidas con tu humano y afecte
a otros, escríbelo aquí.

## Al empezar cada sesión
1. `git pull --rebase` en `main`.
2. Lee `ESTADO.md` y `EQUIPO.md`.
3. Revisa las tareas: `gh issue list` (y `gh pr list` para ver qué está en revisión).
4. Si tu humano no aparece en `EQUIPO.md`, agrégalo (ver "Unirse al equipo" abajo).

## Unirse al equipo (primera vez)
1. Tu humano necesita acceso de escritura. Si no lo tiene, pídele que le pase su usuario de GitHub al
   dueño del repo (@chekitocantu). El agente del dueño lo invita con:
   `gh api -X PUT repos/chekitocantu/hackathon-equipo/collaborators/<usuario>`
   y el invitado acepta en https://github.com/notifications o con
   `gh api -X PATCH user/repository_invitations/<id>` (el id sale de `gh api user/repository_invitations`).
2. Clona el repo fuera de cualquier otro repo: `gh repo clone chekitocantu/hackathon-equipo`.
3. Agrega una fila a `EQUIPO.md` con tu humano y súbela directo a `main` (es un cambio chico).
4. Si tu humano no tiene rol, pregúntale qué le gusta hacer y propón uno según lo que falte en los issues.

## Cómo tomar y hacer una tarea
1. **Elige un issue sin asignar.** Nunca tomes uno asignado a otra persona; si crees que está abandonado,
   pregunta en un comentario del issue.
2. **Reclámalo antes de escribir código**, para que ningún otro agente lo tome:
   `gh issue edit <n> --add-assignee @me --add-label en-curso`
3. **Rama** desde `main` actualizado: `<usuario>/<n>-descripcion-corta` (ej. `chekitocantu/12-login`).
4. Haz commits chicos. Antes de abrir el PR: `git pull --rebase origin main` y prueba que corre.
5. **PR** con `gh pr create`, y en la descripción `Closes #<n>`, qué cambió y cómo probarlo.
6. **Merge**: si el cambio es chico y pasó las pruebas, puedes hacer merge tú (`gh pr merge --squash --delete-branch`).
   Si toca algo de otra persona o cambia una decisión de `ESTADO.md`, pide revisión a quien corresponda.
7. Si te bloqueas: etiqueta `bloqueado` y explica en el issue qué necesitas y de quién.

¿Falta una tarea? Créala con `gh issue create` siguiendo la plantilla: objetivo, criterio de terminado y archivos.
Mejor varias tareas chicas que una grande: así se reparten entre más agentes.

## Cambios directos a main
Sí: correcciones a `EQUIPO.md`, `ESTADO.md` y documentación. Haz `git pull --rebase` justo antes de `git push`.
No: código. El código siempre va por rama y PR, aunque sea pequeño.

## ESTADO.md
- "Estado actual": breve y al día. Reescríbelo, no lo acumules.
- "Decisiones": es histórico. Agrega al final con fecha (AAAA-MM-DD), quién decidió y por qué.
- Decisiones de producto o de alcance (qué hace la app, qué se recorta) las toman los humanos, no los agentes.
  Si hace falta una, pregúntale a tu humano o deja la pregunta en un issue con la etiqueta `decision`.

## Reglas que no se rompen
- **Nunca subas secretos** (API keys, tokens, contraseñas, `.env`). Usa `.env` local y documenta las
  variables en `.env.example` con valores falsos.
- **Nunca `git push --force` a `main`** ni reescribas historia compartida.
- No borres ni reescribas trabajo de otra persona para resolver un conflicto: combina los dos lados.
  Si no sabes cómo, pregunta en el PR.
- No cambies la estructura del proyecto, el stack ni dependencias grandes sin anotarlo en "Decisiones".
- Antes de entregar, el proyecto tiene que correr siguiendo solo lo que dice `ESTADO.md` → "Cómo correrlo".

## Comunicación entre agentes
Los agentes no se ven entre sí. Se comunican por el repo: issues, comentarios, PRs y `ESTADO.md`.
Si dejas algo a medias, comenta en el issue en qué quedó y qué falta. Así otro agente puede seguir.
