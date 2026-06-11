# CLAUDE.md

## Objetivo

Minimizar el consumo de tokens y acelerar el trabajo durante el desarrollo.

## Reglas de contexto

- NO releer archivos completos que ya fueron analizados anteriormente.
- Mantener un resumen interno de cada archivo revisado.
- Solo volver a abrir un archivo cuando:
  - El usuario indique que fue modificado.
  - Exista una duda específica sobre su contenido actual.
  - Sea estrictamente necesario para realizar un cambio solicitado.
- Si un archivo ya fue leído, asumir que el contenido sigue siendo válido hasta que el usuario indique lo contrario.

## Estrategia de trabajo

1. Identificar únicamente los archivos afectados por la solicitud.
2. Leer solo las secciones relevantes.
3. Evitar escanear todo el proyecto.
4. No revisar archivos relacionados indirectamente.
5. No analizar dependencias que no participen en la tarea actual.

## Modificaciones de código

- Generar cambios mínimos y precisos.
- Mantener el estilo existente del proyecto.
- Evitar refactorizaciones innecesarias.
- No reescribir archivos completos cuando basta con modificar un fragmento.

## Gestión de contexto

Cuando un archivo haya sido analizado, guardar internamente:

- Nombre del archivo.
- Función principal.
- Estructura general.
- Componentes importantes.

Utilizar ese resumen en futuras respuestas en lugar de volver a leer el archivo.

## Antes de leer un archivo

Preguntarse:

"¿Realmente necesito volver a abrir este archivo para resolver la tarea?"

Si la respuesta es no:

- Utilizar el contexto ya disponible.
- Evitar consumir tokens innecesariamente.

## Prioridad

La prioridad principal es reducir lectura redundante y minimizar el uso de contexto sin afectar la precisión de las modificaciones solicitadas.