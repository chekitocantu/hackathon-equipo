# Propuesta de Hackathon: el Traductor, copiloto de ventas en vivo para Alestra

> Todo lo que dice este guion sale del catálogo simulado (`catalogo-simulado/`) y del caso que corre la app
> (`landing/src/lib/casos.ts`, caso «Aceros del Valle»). Si algo cambia en el catálogo, cambia aquí.
> Precios en MXN, sin IVA salvo donde se indica.

## 1. El problema en Alestra (el cuello de botella)
Hoy el cliente necesita **3 sesiones en promedio** para dejar completo su requerimiento, y la propuesta
económica tarda **hasta 3 semanas**, aunque el **60% de lo que se cotiza es estándar** con precio fijo
(ver `RETO.md`). Pasa porque tres partes hablan "idiomas" distintos:

1. **El cliente:** habla en *dolores de negocio* ("se nos fue la luz y paramos la operación").
2. **El ejecutivo de ventas:** habla en *términos comerciales* y no conoce todo el portafolio: no sabe qué
   preguntar, y el levantamiento queda incompleto.
3. **El arquitecto de soluciones:** habla en *parámetros de infraestructura* (U de rack, TB, RPO/RTO). Como las notas
   llegan incompletas, entra **casi siempre** y el cliente vuelve a explicar todo.

La información ya existe (catálogo, precios, reglas de cuándo entra un arquitecto). Lo que falta es que llegue
al vendedor **en el momento** en que el cliente habla.

---

## 2. Nuestra propuesta: ¿qué hace el agente?
Un **copiloto en vivo** que escucha la primera videollamada y le muestra al vendedor, en su pantalla, lo que
el catálogo dice de lo que el cliente acaba de contar.

### A. Traductor en vivo, anclado al catálogo
* **De queja a producto:** escucha el problema y marca qué productos del catálogo lo resuelven. Solo puede usar
  SKU que existen; si el modelo propone otro, el sistema lo descarta.
* **De requisito técnico a pregunta humana:** muestra la siguiente pregunta en lenguaje sencillo, tomada de las
  "preguntas clave" del catálogo, con su fuente a la vista (ej. *Catálogo · Colocation 1/4 de rack*).

### B. Lo que falta saber
* Una lista de los datos que faltan para cotizar el caso. Se va llenando sola con lo que dice el cliente.
* Las sugerencias esperan una pausa o a que el cliente toque el tema, para no interrumpirlo.

### C. Estándar contra a la medida, sin adivinar
* **Las cuentas no las hace la IA.** Precio, paquete, plazo e IVA salen del catálogo con código determinista.
  Los límites de cantidad, el monto de ESC-09 y los productos a la medida también se revisan en código.
* **Reglas de escalamiento (ESC):** cuando el cliente dice algo que cumple una regla, el tablero dice cuál
  y por qué entra el arquitecto, y solo en esa parte. Lo demás lo cotiza el vendedor ese mismo día.

### D. Cotización en vivo
* El total mensual se arma mientras se habla. Si falta un dato, el tablero dice **"Total parcial"** y qué falta;
  nunca muestra un número como si estuviera completo.

---

## 3. Guion del demo en vivo (caso Aceros del Valle, manufactura, Apodaca)

**Configuración en el escenario:**
* **Persona A:** el cliente (gerente de operaciones de Aceros del Valle).
* **Persona B:** el vendedor de Alestra.
* **Pantalla proyectada:** `/llamada` → "Ver demo" con el caso *Aceros del Valle*, o la misma conversación
  dicha en voz alta. Si la red falla, el modo demo sigue con el guion del caso (respaldo).

---

### TURNO 1: detección del dolor

#### 1. Lo que dice el cliente:
> *"Nuestro ERP corre en dos servidores en un cuarto de la planta. Se nos fue la luz dos veces este año y paramos la operación."*

#### 2. Lo que hace el agente en el monitor del vendedor:
* **Producto:** marca *Colocation 1/4 de rack* (SIM-DC-01) como pendiente de dimensionar y sugiere
  *Backup inmutable en la nube* (SIM-BK-01).
* **Lo que falta saber:** recursos de los servidores, cuántas horas pueden estar sin sistema y si las
  sucursales se conectan al ERP. Son los datos que el catálogo pide para este caso.
* **Pregúntale ahora:** *"¿Cuántos equipos y cuántas U ocupan?"*. Fuente: *Catálogo · Colocation 1/4 de rack*.

#### 3. Lo que dice el vendedor:
> *"Entiendo; con dos apagones al año, sacar esos servidores del cuarto de la planta tiene mucho sentido. Para darte un precio hoy mismo: ¿cuántos equipos son y cuánto espacio de rack ocupan?"*

---

### TURNO 2: dimensionamiento

#### 1. Lo que dice el cliente:
> *"Son dos servidores de 2U y un switch; casi no consumen. Tenemos 3 sucursales que entran al ERP."*

#### 2. Lo que hace el agente:
* **Cotiza lo estándar:** *Colocation 1/4 de rack* ($7,900), *Enlace dedicado al data center* para las 3 sucursales
  (3 × $4,200) y *Backup de servidores* para 2 servidores (2 × $420).
* **Total parcial:** **$21,340 al mes**, más $11,000 de cargos únicos. El tablero avisa que falta un producto
  sin precio, porque el backup inmutable todavía necesita saber cuántos TB.
* **Pregúntale ahora:** *"¿Cuánto tiempo pueden estar sin sistema?"*. Fuente: *Catálogo · Recuperación ante desastres (DRaaS)*.
  Es la pregunta que puede cambiar el caso: si la respuesta es menos de 4 horas, ya no es un nivel de servicio
  estándar (regla ESC-07).

#### 3. Lo que dice el vendedor:
> *"Perfecto, con eso ya tengo el espacio y la conexión de tus 3 sucursales. Una pregunta importante: si mañana se cae todo, ¿cuánto tiempo pueden estar sin sistema? Y, entre los dos servidores, ¿cuánta información guardan?"*

---

### TURNO 3: cotización y escalamiento honesto

#### 1. Lo que dice el cliente:
> *"Máximo una hora; cada hora parada es producción perdida. Entre los dos servidores son como 3 TB."*

#### 2. Lo que hace el agente:
* **Completa lo estándar:** *Backup inmutable* con 3 TB (3 × $1,850). Se activa el paquete
  **«Adiós al cuarto de servidores»** (8% de descuento en colocation, enlace y backup).
* **Cotización:** **$24,806 al mes sin IVA ($28,775 con IVA)**, más $13,500 de cargos únicos, a 12 meses.
  A 36 meses baja a $22,325, pero el descuento total llega a 17%: pasa del 10% que puede dar el vendedor, y el
  tablero avisa que requiere autorización del gerente.
* **Escalamiento honesto:** "máximo una hora" es un RTO menor a 4 h, así que se cumple la **regla ESC-07**.
  La *Recuperación ante desastres* pasa al arquitecto y el caso queda **mixto**: el vendedor cotiza hoy lo
  estándar, y el arquitecto entra **solo** a diseñar la recuperación, con el resumen de la llamada.

#### 3. Lo que dice el vendedor (cierre en la llamada 1):
> *"Te dejo cotizado hoy lo que resuelve los apagones: espacio en nuestro data center, el enlace de tus 3 sucursales y el respaldo de tus 3 TB, en $24,806 más IVA al mes. Para volver a operar en menos de una hora hace falta un diseño especial: le paso a nuestro arquitecto todo lo que ya me contaste, para que no tengas que repetirlo, y te busca solo para esa parte."*

---

## 4. Impacto para Alestra (resumen para jueces)

| Etapa del proceso | Hoy (sin agente) | Con el Traductor |
| :--- | :--- | :--- |
| **Levantamiento** | 3 sesiones en promedio; el vendedor no sabe qué preguntar. | Las preguntas clave del catálogo aparecen en vivo y "lo que falta saber" se llena en la primera llamada. |
| **Arquitectos** | Entran casi siempre y el cliente repite todo. | Entran solo cuando una regla ESC o un producto a la medida lo pide, y solo en esa parte (aquí: la recuperación con RTO de 1 h). |
| **Propuesta económica** | Hasta 3 semanas, armada a mano. | Lo estándar queda cotizado en la llamada, con precios del catálogo; lo a la medida sale con su resumen para el arquitecto. |
| **Datos inventados** | — | El modelo no escribe precios ni inventa productos: solo marca SKU del catálogo, y las cuentas y los límites los revisa el código. |
