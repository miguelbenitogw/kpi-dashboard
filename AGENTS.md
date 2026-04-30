<!-- BEGIN:system-reference -->
# PRIMERA REGLA — leer SYSTEM.md antes de cualquier cosa

**Ante cualquier duda sobre el sistema, antes de implementar cualquier funcionalidad nueva, y al abrir cualquier conversación sobre este proyecto: leer `SYSTEM.md` en la raíz del repositorio.**

`SYSTEM.md` es la fuente de verdad del sistema. Contiene:
- Arquitectura de datos completa (tablas, relaciones, campos clave)
- Clasificación de vacantes (atracción vs formación)
- Pipeline de datos y crons
- APIs y endpoints disponibles
- Problemas conocidos y limitaciones
- Ideas pendientes de implementar

No implementes nada sin haberlo consultado primero. Si algo no está documentado en SYSTEM.md, documentalo ahí antes de continuar.
<!-- END:system-reference -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:context-management -->
## Context window discipline

**Always use sub-agents** for tasks that would inflate the main context:
- Reading 4+ files to understand the codebase → delegate exploration
- Writing features that touch multiple files → delegate the whole thing
- Running scripts, builds, or tests → delegate
- Executing batched DB operations (e.g. 40+ SQL calls) → delegate
- Any task that produces large output (logs, SQL dumps, API responses)

The main agent coordinates. Sub-agents do the work and return concise summaries.
Never read large files inline when a sub-agent can do it and report back.
<!-- END:context-management -->

## Ideas clave pendientes de implementar

### 1. Sistema de clasificación de vacantes: formación vs atracción
Cada vacante de Zoho se clasifica como `atraccion` o `formacion`. Para una promoción se asocian:
- **Vacantes de atracción** — procesos reales de reclutamiento, cuentan en KPIs de atracción
- **Vacantes de formación** — entradas de Zoho que representan la formación interna; se excluyen de los conteos de reclutamiento y se tracean por separado

**Insight clave**: Las vacantes de formación de Zoho son el mismo concepto que las promociones (`promotions_kpi`), pero guardadas en sistemas distintos. El puente es una capa de clasificación — no duplicar lógica.

Implementación prevista:
- Nueva tabla en Supabase: `promo_vacancy_links` (promo_id, vacancy_id, type: 'atraccion' | 'formacion')
- UI en el dashboard para asociar vacantes a promos y marcar su tipo
- Queries de atracción filtran `type = 'atraccion'` para excluir formación de métricas
- Las tasas de éxito de formación se calculan y muestran por separado

### 2. Gráfico de vacantes de atracción por promoción
Cuando el usuario selecciona una promoción, mostrar un gráfico con el total de alumnos de esa promo por vacante de atracción en la que estuvieron.

Fuente de datos: cruce de `candidates_kpi.promocion_nombre` × `candidate_job_history_kpi.job_opening_id`

Resultado: gráfico de barras/torta — "Promo 113 → 30 en Infirmiers pour la Norvège, 10 en Enfermeros Bélgica, 5 en Auxiliares Holanda"

**Por qué empezar por esto**: Los datos ya existen, no requiere schema nuevo. Es una query + componente. Además sirve como mapa para saber qué vacantes clasificar en la Idea 1.
