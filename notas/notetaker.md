# Notetaker: de dónde sale la transcripción

**Responsable:** Sergio (@chekitocantu) · **Última actualización:** 2026-10-24 · Issue: #7

El Traductor necesita el texto de la reunión **mientras pasa** (para los avisos al vendedor) y, al final,
**quién dijo qué** (para los reportes de cada área).

## Qué usamos: notetaker propio en el navegador
Código en `prototipos/notetaker/` (rama `chekitocantu/prueba-vexa`, sube por PR). Se corre con
`node prototipos/notetaker/server.mjs` y se abre http://localhost:5180 en Chrome, Edge o Brave.

Funciona en dos capas:

| Capa | Cómo | Tiempo | Para qué |
|---|---|---|---|
| **En vivo** | Graba el micrófono (y, opcional, el audio de la llamada aparte), corta en las pausas, transcribe con OpenRouter `openai/gpt-4o-mini-transcribe` en español y DeepSeek corrige siglas y números | texto en ~0.6 s, corregido en 1-5 s | Avisos al vendedor |
| **Al terminar** | La grabación completa va a `elevenlabs/scribe-v2` (separa voces) y DeepSeek le pone nombre a cada voz con la lista de asistentes | ~2 s por minuto + ~10 s | Reportes con quién pidió qué |

- **Quién habla en vivo:** en llamadas, micrófono = vendedor y audio de la llamada = cliente. En persona, DeepSeek lo
  deduce por lo que dicen y por la lista de asistentes que el vendedor escribe al empezar ("Laura – Finanzas").
- **Costo aproximado:** US$0.10 por hora en vivo + US$0.20 por hora la separación de voces + DeepSeek.
- **Por qué no Meetily ni Vexa:** Meetily solo transcribe en la laptop (Whisper turbo iba muy lento en nuestra tarjeta)
  y su versión gratis no tiene API ni separa voces. Vexa necesita que un bot entre a la llamada y no sirve en persona.
  Para el pitch: en producción la transcripción se puede alojar en servidores de Alestra.

## Formato que le llega al cerebro (para @brioness47)
Un segmento por línea, en JSON. **Para los reportes usa la transcripción final**, que tiene los nombres buenos:

```json
{"hablante": "Laura (Finanzas)", "rol": "cliente", "texto": "El contrato lo preferimos a 36 meses.", "inicio": "2026-10-24T19:17:23.000Z"}
```

- `hablante`: "Nombre (Área)" si se sabe; si no, `vendedor`, `cliente` o `desconocido`.
- `rol`: `vendedor` o `cliente` (o `desconocido` en vivo, si no se puede saber).
- `texto`: ya corregido. En vivo viene además `original` (lo que entendió el motor) para comparar.
- `inicio`: hora en que empezó a hablar (ISO 8601). Sirve para citar de dónde salió cada dato.

Se descarga desde la página (en vivo y final) y también queda en `prototipos/notetaker/salida/` (no se sube al repo).
