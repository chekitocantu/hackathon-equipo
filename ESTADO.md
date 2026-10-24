# Estado del proyecto

**Última actualización:** 2026-10-24 — @chekitocantu

## Idea
Reto: **"Del primer contacto a la propuesta"** — ver [RETO.md](RETO.md) (problema, indicadores, rúbrica y agenda).
Idea del equipo: **el "Traductor"** (detalle y ajustes por discutir en el issue #1).

- **Problema:** la información existe, pero no llega a ventas durante la reunión ni pasa bien a Finanzas e Ingenieros. Por eso hay levantamientos incompletos, el cliente repite todo y las propuestas tardan.
- **Solución:** un agente en vivo con ventas de Alestra que toma notas y avisa en pantalla lo que se omitió o conviene mencionar. Al terminar, manda a Finanzas y a Ingenieros lo que tiene que hacer cada uno, en su propio lenguaje.
- **MVP (lo mínimo para la demo):**
- **Fuera de alcance:**

## Stack
Por definir.

## Estado actual
Ya tenemos el reto (RETO.md), la idea base (el Traductor), una landing, un dashboard inicial y un catálogo simulado
(`catalogo-simulado/`). Falta acordar el MVP (#1) y el stack (#2). Próximo checkpoint: 17:00, prototipo funcional.

**Quién hace qué** (detalle en [EQUIPO.md](EQUIPO.md)):

| Quién | Qué |
|---|---|
| Karim | Dashboard para ventas |
| Marco | Dolores de clientes: reseñas negativas de apps que hacen cosas como las de Alestra (sirve para el pitch y para saber qué avisar) |
| Sergio | Notetaker: transcripción en vivo y, al terminar, voces separadas con nombre (#7) → [notas/notetaker.md](notas/notetaker.md) |
| Rubén | Cerebro del Traductor: avisa en vivo lo que se le pasa a ventas y al final manda a cada área (IT, Finanzas) su reporte con sus términos y acrónimos → [notas/lenguaje-traductor.md](notas/lenguaje-traductor.md) |

Lo que une al notetaker con el cerebro es el formato de los segmentos de la transcripción: propuesta en
[notas/notetaker.md](notas/notetaker.md#formato-que-le-llega-al-cerebro-para-brioness47).

## Cómo correrlo
El esqueleto del proyecto completo sigue por definir (#2). Lo que ya corre:

- **Notetaker** (`prototipos/notetaker/`, detalle en [notas/notetaker.md](notas/notetaker.md)): con Node 22+ y una key de
  OpenRouter (`sk-or-...`) en `~/.openrouter-key`, corre `node prototipos/notetaker/server.mjs` y abre
  http://localhost:5180 en Chrome, Edge o Brave.

## Entrega
- Fecha y hora límite: **2026-10-24 a las 19:00, sin excepciones**
- Qué se entrega: repo, demo y pitch deck
- Checkpoints: 12:30 problema bien definido · 17:00 prototipo funcional

## Decisiones
- 2026-10-24 — @chekitocantu: las tareas viven en GitHub Issues y no en archivos, para que varios agentes las reclamen sin conflictos de merge.
- 2026-10-24 — @chekitocantu: reparto del trabajo: Karim dashboard, Marco dolores de clientes, Sergio notetaker, Rubén cerebro del Traductor.
- 2026-10-24 — @chekitocantu: la transcripción en vivo se prueba con la API en la nube de Vexa (no instalada local: pide Docker y GPU).
  Para la demo hay una transcripción simulada de respaldo. Meetily se descartó como fuente porque su versión gratis
  no tiene API ni separa quién habla. Detalle en `notas/notetaker.md`.
