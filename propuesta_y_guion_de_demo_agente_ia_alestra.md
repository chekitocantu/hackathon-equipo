# Propuesta de Hackathon: Alestra Live Architect & CPQ Copilot

## 1. El Problema en Alestra (El Cuello de Botella)
En las ventas corporativas (B2B) de telecomunicaciones y TI de **Alestra**, el ciclo para entregar una cotización formal toma entre **3 y 4 sesiones (de 2 a 3 semanas)**. Esto ocurre por una desconexión entre tres partes que hablan "idiomas" distintos:

1. **El Cliente:** Habla en *dolores de negocio* ("se me traban las cajas para facturar", "tengo una bodega lejana").
2. **El Ejecutivo de Ventas:** Habla en *términos comerciales*, toma notas en papel o CRM, pero **olvida preguntar parámetros técnicos críticos** porque no es ingeniero.
3. **El Ingeniero de Preventa (Solutions Architect):** Habla en *parámetros duros de infraestructura* (Mbps simétricos, SLA, cobertura de fibra, vCPUs, RTO/RPO). Cuando el vendedor le lleva sus notas incompletas después de la Llamada 1, el ingeniero rebota la solicitud y obliga a agendar una **Sesión 2** para levantar datos técnicos y una **Sesión 3** para presentar el diagrama y el precio.

---

## 2. Nuestra Propuesta: ¿Qué hace el Agente IA?
Desarrollamos un **Copiloto de Preventa y Cotización en Tiempo Real (Live CPQ)** que se sienta "virtualmente" al lado del vendedor durante su primera videollamada con el cliente.

El Agente escucha la llamada en vivo y actúa como un **Arquitecto de Soluciones Senior en el monitor del vendedor**, ejecutando 4 funciones automáticas mientras ocurre la conversación:

### A. Traductor Bidireccional en Vivo
* **De Queja a Solución Técnica:** Escucha el problema coloquial del cliente y selecciona automáticamente qué servicios del catálogo de Alestra lo resuelven (`Managed SD-WAN`, `Internet Dedicado`, `Cloud Express`, `Clean Pipes`, `Alestra Móvil`).
* **De Requisito Técnico a Pregunta Humana:** Identifica qué datos técnicos exige el cotizador de Alestra y le muestra al vendedor en pantalla una **pregunta sencilla en lenguaje humano** para que se la haga al cliente en ese instante.

### B. Sistema "Anti-Olvido" (Dynamic Slot-Filling)
* Abre un checklist dinámico en pantalla por cada producto detectado.
* Si al vendedor le falta preguntar un dato obligatorio para cotizar (ej. cantidad de sucursales, ubicación o tipo de nube), el agente lanza una **Alerta en Vivo** antes de que termine la llamada.

### C. Dimensionamiento y Reglas de Factibilidad Automáticas
* El cliente no sabe cuántos `Mbps` o `vCPUs` necesita. Cuando el cliente dice *"tengo 15 computadoras y cámaras"*, el Agente calcula automáticamente el ancho de banda técnico (`100 Mbps simétricos`).
* Si detecta una ubicación sin cobertura de fibra óptica (ej. una bodega industrial en las afueras), **reemplaza o complementa automáticamente** ese nodo con **`Alestra Móvil (SIM Multioperador 5G)`** sin frenar la cotización.

### D. Generador de Arquitectura y Cotización en 1 Clic (Live BOM)
* Dibuja en tiempo real el diagrama técnico de red en la pantalla para que el vendedor pueda compartirlo antes de colgar.
* Calcula el precio mensual estimado (OPEX) en vivo y genera el PDF formal con la tabla técnica (Bill of Materials) en el minuto 15 de la **primera llamada**.

---

## 3. Guion del Demo en Vivo (Del Turno 1 al Cierre)

**Configuración en el escenario:**
* **Persona A:** Actúa como el Cliente (Dueño de una cadena de ferreterías).
* **Persona B:** Actúa como el Vendedor de Alestra.
* **Pantalla Proyectada:** Muestra la interfaz de nuestro Agente IA reaccionando en vivo a la voz.

---

### TURNO 1: Detección del Dolor y Mapeo Inicial

#### 1. Lo que dice el Cliente (en la llamada):
> *"Hola, mira, tenemos 10 ferreterías acá en Monterrey y Saltillo. Nuestro problema es que usamos un sistema en la nube para cobrar, pero a cada rato el internet se pone lentísimo y las cajas se quedan trabadas sin poder facturar."*

#### 2. Lo que hace el Agente IA en el Monitor del Vendedor (en menos de 2 segundos):
* **Extracción de Entidades:** Detecta Giro = `Comercio / Retail`, Sitios = `10 sucursales`, Ciudades = `Monterrey, Saltillo`.
* **Traducción Técnica:** Diagnostica saturación de ancho de banda sin priorización de tráfico (QoS).
* **Activación de Catálogo Alestra:** Agrega al cotizador `Internet Dedicado` + `Managed SD-WAN` (para darle prioridad al tráfico de las cajas registradoras).
* **Barra de Precisión de Cotización:** Sube a **30%**.
* **Alerta Anti-Olvido (Susurro al Vendedor):**
  > **PREGÚNTALE ESTO AHORA:** *"¿Cuántas computadoras o cajas tienen por tienda y en qué nube (AWS, Azure, etc.) está guardado su sistema de cobro?"*

#### 3. Lo que contesta el Vendedor (leyendo a su Agente):
> *"Te entiendo perfecto. Para que tus cajas nunca se traben aunque alguien más esté descargando archivos pesados, te voy a armar una red **Managed SD-WAN de Alestra** que le da prioridad VIP a tu facturación. Oye, para darte el precio exacto ahorita mismo: **¿cuántas computadoras tienen por tienda y en qué nube tienen su sistema?**"*

---

### TURNO 2: Traducción Humana a Dimensionamiento Técnico + Cross-Selling

#### 1. Lo que dice el Cliente:
> *"Híjole, no sé cuántos megas gastamos, pero son como 15 computadoras por sucursal y además tenemos cámaras de seguridad. El sistema lo tenemos guardado en Amazon (AWS)."*

#### 2. Lo que hace el Agente IA en el Monitor del Vendedor:
* **Cálculo de Ingeniería Automático:** El Agente traduce `15 PCs + Cámaras de video` a un parámetro técnico exacto: **`100 Mbps simétricos por sucursal`** y llena la celda en la tabla de cotización sin intervención humana.
* **Cross-Selling Inteligente:** Al escuchar `"Amazon (AWS)"`, el Agente conecta un nodo nuevo en el diagrama visual: **`Alestra Cloud Express`** (enlace privado directo a AWS sin pasar por el internet público para eliminar la latencia).
* **Barra de Precisión de Cotización:** Sube a **75%**.
* **Alerta Anti-Olvido (Último filtro técnico):**
  > **PREGÚNTALE ESTO AHORA:** *"¿Alguna de las 10 tiendas está en una zona industrial lejana donde no llegan cables de fibra, y qué tan grave es para el negocio si se corta el cable en la calle?"*

#### 3. Lo que contesta el Vendedor:
> *"Excelente. Para esas 15 computadoras y tus cámaras te estoy calculando **100 Megas dedicados por tienda**, y además te voy a incluir **Cloud Express**, que es un túnel privado directo de Alestra hacia tu Amazon para que vuele. Última pregunta rápida: **¿alguna de tus 10 tiendas está en una zona lejana donde batallen con el cableado, y qué pasa si un día una tienda pierde conexión?**"*

---

### TURNO 3: Resolución de Factibilidad en Vivo y Cotización en 1 Clic

#### 1. Lo que dice el Cliente:
> *"Qué bueno que preguntas, porque nuestra bodega nueva está en las afueras de Ramos Arizpe y ninguna compañía tiene postes de fibra ahí. Y la verdad no nos podemos quedar sin sistema ni 5 minutos."*

#### 2. Lo que hace el Agente IA en el Monitor del Vendedor:
*(Nota para los jueces: En el proceso tradicional, esta bodega sin fibra detendría la cotización durante 2 semanas mientras ingeniería busca alternativas. El Agente lo resuelve en vivo).*
* **Ajuste Automático de Arquitectura por Cobertura:**
  * `9 Sucursales Urbanas`: Se mantienen con **Fibra Dedicada 100 Mbps + SD-WAN**.
  * `1 Bodega en Ramos Arizpe (Sin Fibra)`: El Agente asigna automáticamente **`Alestra Móvil (SIM Multioperador 5G)`**, que se conecta a las 3 redes celulares del país sin requerir cableado físico.
* **Alta Disponibilidad y Seguridad:** Al escuchar *"no podemos parar ni 5 minutos"*, agrega un enlace secundario celular de respaldo para las sucursales y activa **`Clean Pipes`** (mitigación de ataques DDoS desde el enlace).
* **Barra de Precisión de Cotización:** Llega al **100% (Quote Ready)**.
* **Cierre Habilitado:** Dibuja el diagrama de red completo en pantalla, calcula el total en **$4,200 USD / mes** y habilita el botón verde **"Compartir Arquitectura y Enviar Propuesta PDF"**.

#### 3. Lo que contesta el Vendedor (Cierre en la Llamada 1):
> *"Resuelto, no necesitamos agendar otra sesión con ingeniería. Mira, te comparto mi pantalla: tus 9 tiendas quedan con fibra dedicada de 100 Megas, tu conexión directa a Amazon con Cloud Express y, para tu bodega de Ramos Arizpe donde no llegan cables, te configuré **Alestra Móvil con SIM Multioperador** para que tengas conexión desde el día uno, además de protección **Clean Pipes**. Tu inversión mensual queda en **$4,200 dólares**. Ya te envié a tu correo el PDF con el diagrama técnico y el desglose, ¿le damos para adelante?"*

---

## 4. Impacto de Negocio para Alestra (Resumen para Jueces)

| Etapa del Proceso | Proceso Actual en Alestra (Sin Agente) | Nuevo Proceso con Nuestro Agente IA |
| :--- | :--- | :--- |
| **Levantamiento de Datos** | El vendedor toma notas incompletas en papel; olvida preguntar métricas técnicas (Mbps, nube, cobertura). | El Agente guía al vendedor con alertas en vivo (**0% de datos técnicos olvidados**). |
| **Dimensionamiento e Ingeniería** | Requiere escalar a un Ingeniero de Preventa y esperar días para traducir qué necesita el cliente. | El Agente traduce "15 PCs + cámaras" a `100 Mbps` y resuelve falta de fibra con `Alestra Móvil` al instante. |
| **Tiempo para Entregar Cotización** | **3 a 4 sesiones (2 a 3 semanas).** Alto riesgo de que el cliente se enfríe o compre con la competencia. | **1 sola sesión (15 minutos).** El cliente recibe arquitectura visual y cotización formal antes de colgar. |
| **Ticket Promedio (Upselling)** | El vendedor solo cotiza lo básico por miedo a complicar la llamada. | El Agente inyecta sugerencias automáticas de alto margen (`Cloud Express`, `Clean Pipes`, `SD-WAN`). |