# Notetaker: de dónde sale la transcripción en vivo

**Responsable:** Sergio (@chekitocantu) · **Última actualización:** 2026-10-24

El Traductor necesita el texto de la reunión **mientras pasa**, separado por quién habla (vendedor o cliente).
Esta nota resume qué herramientas open source revisamos y cuál usamos.

## Opciones revisadas

| | Vexa | Meetily (versión gratis) |
|---|---|---|
| Cómo escucha | Un bot entra a la llamada (Meet, Teams, Zoom) | App de escritorio que graba el micrófono y el audio de la compu; no entra ningún bot |
| Reuniones en persona | No | Sí |
| API para leer la transcripción en vivo | Sí (`GET /transcripts/...`) | No (solo en Meetily PRO, que es de paga) |
| Separa quién habla | Sí | No (solo PRO, "coming soon") |
| Costo | ~US$0.50 por hora de bot en su nube; gratis si se instala en servidores propios | Gratis |
| Dónde se procesa el audio | Su nube, o servidores propios (Apache 2.0) | La compu del usuario (MIT) |
| Liga | https://github.com/Vexa-ai/vexa | https://github.com/Zackriya-Solutions/meetily |

**Por qué no lo instalamos local hoy:** Vexa local necesita Docker y un equipo con GPU para transcribir.
Para el hackathon usamos su API en la nube.

## Plan
1. **Demo:** reproducir una conversación de ejemplo como si fuera en vivo (línea por línea, con pausas).
   No depende del wifi ni de que alguien admita al bot, así que no falla frente a los jueces.
2. **Si sale la prueba con Vexa:** mostrar una llamada real (en vivo o grabada antes) con el mismo cerebro detrás.
3. **Pitch:** "en producción entra a sus llamadas de Teams y se puede alojar en los servidores de Alestra";
   para visitas en persona, una app sin bot como Meetily graba desde la laptop del vendedor.

## Formato que le llega al cerebro (propuesta, para @brioness47)
Las dos fuentes (simulada y Vexa) entregan lo mismo, para que el cerebro no sepa ni le importe de dónde viene.
Un segmento por línea, en JSON:

```json
{"hablante": "vendedor", "texto": "¿Cuántas sucursales necesitan conectar?", "inicio": "2026-10-24T15:02:11Z"}
```

- `hablante`: `vendedor`, `cliente` o el nombre que dé Vexa si no se sabe el rol.
- `texto`: lo que dijo; un segmento puede corregirse después (llega otra vez con el mismo `inicio` y otro texto).
- `inicio`: hora en que empezó a hablar (ISO 8601). Sirve para citar de dónde salió cada dato.

Si el cerebro necesita otro campo, coméntalo en el issue del notetaker o del cerebro.

## Estado
- Script de prueba con Vexa (manda el bot y muestra la transcripción en la terminal): listo en una rama local de Sergio,
  falta la API key y hacer una llamada de prueba. Sube por PR cuando funcione.
