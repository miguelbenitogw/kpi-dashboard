# SYSTEM.md — Referencia técnica y de negocio del KPI Dashboard

> Documento generado el 30/04/2026. Es la fuente de verdad para cualquier agente o desarrollador que trabaje en este proyecto. No leer el código fuente para entender la arquitectura — leer esto primero.

---

## Documentación relacionada

| Archivo | Qué contiene |
|---------|-------------|
| `SYSTEM.md` (este) | Fuente de verdad: modelo de datos, lógica de negocio, problemas conocidos, quirks de APIs |
| `AGENTS.md` | Instrucciones para agentes, reglas de contexto, ideas pendientes |
| `STRUCTURE.md` | Árbol de archivos, mapa de rutas (22 pages), inventario de ~135 componentes, 19 módulos de queries |
| `API-REFERENCE.md` | Los 51 endpoints documentados, 9 cron jobs, patrones de auth, diagrama del pipeline de datos |
| `INTEGRATIONS.md` | Integraciones externas: Zoho (auth, client, sync, quirks), Google Sheets, GA4, YouTube, OpenAI, Supabase |
| `INFRASTRUCTURE.md` | Next.js config, middleware MFA, vercel.json, env vars, 33 migraciones DB, dependencias |

---

## 1. Visión general del negocio

**GlobalWorking** es una empresa de reclutamiento internacional especializada en colocar profesionales sanitarios (enfermeros, fisioterapeutas, médicos) y educativos (maestros) en países como Noruega, Alemania y Bélgica. Gestiona el proceso completo: captación de candidatos, formación lingüística y profesional, y colocación final en clientes (hospitales, kommuner noruegos, etc.).

El **KPI Dashboard** es el panel de control interno que mide ese proceso en tres ejes:

| Eje | Qué mide |
|-----|----------|
| **Atracción** | Captación de candidatos — CVs recibidos, conversión al pipeline, vacantes activas |
| **Formación** | Evolución de candidatos en el programa formativo — retención, abandonos, trayectorias |
| **Colocación** | Candidatos finalmente colocados en clientes — estado GP, contratos, billing |

**Usuarios**: coordinadores de promociones, responsables de atracción, dirección.

**Stack** (detalle completo en `INFRASTRUCTURE.md`):
- Frontend: Next.js 16.2.3 (App Router), React 19, TypeScript 5, Tailwind 4, Recharts 3.8
- Backend: Supabase (PostgreSQL + Auth + Realtime + RLS), Vercel (hosting + crons)
- Datos externos: Zoho Recruit (ATS), Google Sheets/Excel Madre, YouTube API, GA4, OpenAI

---

## 2. Arquitectura de datos

### 2.1 Tablas principales

| Tabla | Propósito | Fuente de datos |
|-------|-----------|-----------------|
| `candidates_kpi` | Un candidato por fila. Estado actual, promo, idiomas, tags | Excel Madre (via Google Sheets API) |
| `job_openings_kpi` | Vacantes de Zoho Recruit. ~496 filas | Zoho Recruit API (sync semanal/diario) |
| `candidate_job_history_kpi` | Qué candidatos estuvieron en qué vacantes, y con qué tipo de asociación | Zoho `/Job_Openings/{id}/associate` |
| `promotions_kpi` | Metadatos de cada promoción: objetivos, fechas, coordinador | Excel Madre (hoja Resumen) |
| `vacancy_status_counts_kpi` | Agregado pre-computado: por vacante, cuántos candidatos hay en cada status | Zoho API (solo ~26 vacantes activas con tag) |
| `vacancy_cv_weekly_kpi` | CVs recibidos por vacante por semana ISO | Zoho API (cron lunes) |
| `vacancy_tag_counts_kpi` | Tags de candidatos por vacante, pre-computados | Candidatos locales + Zoho API |
| `stage_history_kpi` | Registro de cambios de status de candidatos en vacantes activas | Generado en cron diario/semanal |
| `sync_log_kpi` | Log de todas las ejecuciones de sync (tipo, status, registros, errores) | Auto-generado por crons |
| `promo_vacancy_links` | Tabla de clasificación manual: promo → vacante → tipo ('atraccion'\|'formacion') | UI del dashboard (admin) |
| `promo_job_link_kpi` | Junction: 1 promo → N job_openings (modelo histórico, distinto de promo_vacancy_links) | Manual / sync |
| `promo_sheets_kpi` | Registro de Google Sheets de promo asociados a cada promoción | Configuración |
| `promo_students_kpi` | Estudiantes importados de las hojas de promo (tab Dropouts, etc.) | Google Sheets API |
| `madre_sheets_kpi` | Registro de Excels Madre activos (con sheet_id de Google) | Configuración |
| `vacancy_cv_sync_state_kpi` | Estado del último sync de CVs por vacante (evita re-fetches innecesarios) | Interno |
| `social_media_snapshots_kpi` | Snapshots diarios de YouTube (subs, vídeos, views) | YouTube Data API v3 |
| `charlas_registros_kpi` | Registros individuales de charlas/webinars de captación | Importación CSV |
| `charlas_temporada_kpi` | Temporadas de charlas | Importación |
| `user_preferences_kpi` | Preferencias de usuario (favoritos de promos, etc.) | UI |

### 2.2 Columnas clave de `candidates_kpi`

| Columna | Descripción |
|---------|-------------|
| `id` | **Candidate_ID de Zoho** — ID corto secuencial (ej: "88082"). NO es el id interno largo de Zoho |
| `full_name` | Nombre completo |
| `current_status` | Estado actual del candidato en Zoho |
| `promocion_nombre` | Nombre de la promo ("Promoción 113"). Texto libre, FK natural |
| `promotion_id` | UUID FK a `promotions_kpi.id` (añadido en migración 021) |
| `tags` | Array de tags de Zoho |
| `assigned_agency` | Agencia asignada para colocación |
| `gp_open_to` | Tipos de colocación aceptados (comma-separated) |
| `dropout_*` | Campos de abandono (fuente real: `promo_students_kpi`, NO estos campos) |

### 2.3 Columnas clave de `job_openings_kpi`

| Columna | Descripción |
|---------|-------------|
| `id` | ID interno de Zoho (largo, 18 dígitos) |
| `title` | Título de la vacante |
| `status` | Estado en Zoho ("In-progress", "Open", etc.) |
| `is_active` | Derivado: status = 'In-progress' OR 'Open' |
| `es_proceso_atraccion_actual` | `true` si tiene el tag "Proceso Atracción Actual" en Zoho. Marca las ~20 vacantes en reclutamiento activo |
| `tipo_vacante` | `'atraccion'` o `'formacion'` — derivado del título por `deriveTipoVacante()` |
| `tipo_profesional` | Tipo de profesional: enfermero, fisioterapeuta, maestro_infantil, maestro_primaria, medico, otro |
| `category` | 'atraccion' \| 'rendimiento' \| 'interna' |
| `total_candidates` | Total de candidatos asociados (sincronizado desde Zoho) |
| `hired_count` | Total contratados (sincronizado desde Zoho) |
| `tags` | Array de tags de Zoho |
| `pais_destino` | País destino de la vacante |
| `weekly_cv_target` | Objetivo semanal de CVs (editable manualmente) |

### 2.4 Columnas clave de `candidate_job_history_kpi`

| Columna | Descripción |
|---------|-------------|
| `candidate_id` | = `candidates_kpi.id` = Candidate_ID corto de Zoho |
| `zoho_record_id` | ID interno largo de Zoho (el `record.id`) |
| `job_opening_id` | = `job_openings_kpi.id` |
| `association_type` | `'atraccion'` o `'formacion'` — clasifica la asociación |
| `candidate_status_in_jo` | Status del candidato DENTRO de esa vacante |
| `fetched_at` | Cuándo se sincronizó esta fila |

**Unique constraint**: `(candidate_id, job_opening_id)` — un candidato aparece una sola vez por vacante.

### 2.5 Columnas clave de `promotions_kpi`

| Columna | Descripción |
|---------|-------------|
| `nombre` | "Promoción 113" — UNIQUE, FK natural de todo el sistema |
| `numero` | 113 |
| `objetivo_atraccion` | Meta de candidatos captados |
| `objetivo_programa` | Meta de candidatos en el programa |
| `expectativa_finalizan` | Cuántos se espera que terminen |
| `pct_exito_estimado` | % estimado de éxito |
| `contratos_firmados` | Contratos firmados con clientes |
| `is_active` | Si la promo está activa actualmente |

### 2.6 Quirks importantes del schema

- **Candidate_ID vs id de Zoho**: `candidates_kpi.id` almacena el `Candidate_ID` corto (ej: "88082"), NO el `record.id` interno de Zoho (ej: "179458000031006174"). Al hacer matching contra Zoho, siempre usar `record.Candidate_ID` primero. Ver comentarios en `sync-candidates.ts`.
- **`promo_vacancy_links` no tiene migración SQL**: está definida en código (queries/atraccion.ts) y fue creada manualmente en Supabase. Es la tabla nueva para clasificar vacantes por promo.
- **`promo_job_link_kpi` vs `promo_vacancy_links`**: son distintas. `promo_job_link_kpi` es el modelo antiguo (1 promo → 1 JO, ahora 1→N). `promo_vacancy_links` es el nuevo para clasificar atraccion/formacion por promo.
- **`dropout_*` en `candidates_kpi`**: estos campos NO son confiables. La fuente real de análisis de dropouts es `promo_students_kpi` donde `tab_name = 'Dropouts'`.

---

## 3. Clasificación de vacantes

### 3.1 El campo `tipo_vacante`

Cada `job_openings_kpi` tiene un campo `tipo_vacante: 'atraccion' | 'formacion'` derivado del título. Lo calcula `deriveTipoVacante()` en `src/lib/utils/vacancy-type.ts`.

**Lógica (primer match gana, accent-insensitive)**:

| Condición | Resultado |
|-----------|-----------|
| Título empieza con "BBDD" | `atraccion` (siempre, aunque contenga "formacion") |
| Título contiene "curso academi" | `atraccion` (charlas universitarias de captación, no formación) |
| Contiene: formaci, programa, promo (word boundary), promoci, promozione, promotion, grupo de formaci, curso (word boundary), bootcamp, masterclass, jornada, taller (con espacio), practicas, convocatoria, inserci, orientaci, fp dual | `formacion` |
| Todo lo demás | `atraccion` |

### 3.2 El flag `es_proceso_atraccion_actual`

Campo boolean en `job_openings_kpi`. Se activa cuando la vacante tiene el tag **"Proceso Atracción Actual"** en Zoho Recruit (match accent-insensitive: contiene "proceso" AND "atrac").

Marca las ~20 vacantes en reclutamiento activo ahora mismo. Es la fuente de verdad para:
- Qué vacantes mostrar en el dashboard de Atracción
- Qué vacantes sincronizar en los crons diarios
- Qué vacantes tienen datos en `vacancy_status_counts_kpi`

**Importante**: una vacante puede tener `tipo_vacante = 'atraccion'` pero `es_proceso_atraccion_actual = false` (vacante cerrada). Son conceptos distintos.

### 3.3 `promo_vacancy_links` — clasificación manual por promo

Tabla que asocia promos a vacantes con tipo explícito:

```
promo_vacancy_links(id, promo_nombre, vacancy_id, tipo: 'atraccion'|'formacion', created_at)
```

Permite marcar, para cada promo, qué vacantes de Zoho son de atracción y cuáles de formación. Es la implementación parcial de la **Idea 1 del AGENTS.md** (ver sección 9).

Funciones en `src/lib/queries/atraccion.ts`: `getPromoVacancyLinks`, `addPromoVacancyLink`, `removePromoVacancyLink`, `getUnlinkedAtraccionVacancies`.

---

## 4. Pipeline de datos (Zoho → Supabase)

### 4.1 Excel Madre / Google Sheets → `candidates_kpi`

El Excel Madre es la fuente de verdad de los candidatos en formación. Se aloja en Google Sheets. Hay uno por temporada; los activos están en `madre_sheets_kpi`.

- **Hoja "Base Datos"**: cada fila = un candidato. Se importa a `candidates_kpi` via `importExcelMadre()` en `src/lib/google-sheets/import-madre.ts`.
- **Hoja "Resumen"**: datos de las promociones (objetivos, fechas). Se importa a `promotions_kpi`.
- **Hoja "Global Placement"**: datos de colocación (agencia, status, fechas). Se upserta en `candidates_kpi`.
- **Sheets por promo**: cada promo tiene su Google Sheet con tabs (Alumnos, Dropouts, etc.). Se importan a `promo_students_kpi` via `importPromoSheet()`.

### 4.2 Zoho Recruit → `job_openings_kpi`

`fetchJobOpenings()` llama a `GET /Job_Openings` con paginación (200/página). `transformJobOpening()` mapea los campos y deriva `tipo_vacante`, `es_proceso_atraccion_actual`, `tipo_profesional`. Se upserta en lotes de 100.

**Campos preservados manualmente** (no se sobreescriben en sync): `tipo_profesional` (si no es 'otro') y `category` (si es 'interna').

### 4.3 Zoho API — quirks críticos

| Endpoint | Estado | Notas |
|----------|--------|-------|
| `GET /Job_Openings` | Funciona | Paginación, 200/página |
| `GET /Candidates` | Funciona | Paginación, filtro Modified_Time |
| `GET /Job_Openings/{id}/associate` | **Funciona** | Devuelve candidatos de una vacante. Clave del backfill |
| `GET /Candidates/{id}/Associate_Job_Openings` | **ROTO** | Devuelve 204/vacío. NO funciona. Por eso existe la estrategia vacancy-first |
| `GET /Candidates/{id}/Notes` | Funciona | Notas de candidatos |

**El problema del Candidate_ID**: el endpoint `/associate` devuelve dos IDs por candidato:
- `record.id` = ID interno largo de Zoho (ej: "179458000031006174")
- `record.Candidate_ID` = ID corto secuencial (ej: "88082")

`candidates_kpi.id` almacena el ID **corto** (`Candidate_ID`). Para hacer matching, siempre usar `record.Candidate_ID ?? record.id`. El `zoho_record_id` en `candidate_job_history_kpi` guarda el ID largo.

**Rate limits**: 200ms entre páginas, 500ms entre vacantes en loops de sync.

### 4.4 Crons — schedule y propósito

| Path | Schedule (UTC) | Qué hace |
|------|---------------|---------|
| `/api/cron/sync` | `0 2 * * *` (diario, 02:00) | Sync vacantes activas (`es_proceso_atraccion_actual=true`) desde Zoho |
| `/api/cron/sync-full` | `0 3 * * 0` (domingos, 03:00) | Sync completo: todas las vacantes + Excel Madre + tags candidatos + tag counts + historial stages |
| `/api/cron/sync-madre` | `0 6 * * *` (diario, 06:00) | Importa Excel Madre (Base Datos + Resumen) + re-sync hojas promo |
| `/api/cron/sync-social` | `0 4 * * *` (diario, 04:00) | Snapshots YouTube → `social_media_snapshots_kpi` |
| `/api/cron/sync-vacancy-cvs` | `15 3 * * 1` (lunes, 03:15) | CVs semanales por vacante activa → `vacancy_cv_weekly_kpi` |
| `/api/cron/sync-placement` | `0 8 * * 1` (lunes, 08:00) | Global Placement tab → campos de colocación en `candidates_kpi` |
| `/api/cron/sync-atraccion-history` | `0 5 * * 1` (lunes, 05:00) | Historial atracción para candidatos de promo → `candidate_job_history_kpi` |

Todos los crons están protegidos por `Bearer CRON_SECRET` en el header `Authorization`. Los crons de Vercel inyectan este header automáticamente.

---

## 5. Historial de candidatos (`candidate_job_history_kpi`)

### 5.1 Qué almacena

Un registro por cada combinación `(candidato, vacante)`. Responde la pregunta: "¿En qué vacantes ha participado este candidato, y con qué rol?".

El campo `association_type` clasifica la relación:

| Valor | Significado |
|-------|-------------|
| `'atraccion'` | El candidato fue reclutado para esa vacante internacional |
| `'formacion'` | El candidato participó en ese proceso formativo |

### 5.2 Cómo se puebla

**Ruta normal (atraccion, cron diario/semanal)**:
1. Para cada vacante activa (`es_proceso_atraccion_actual=true`), llamar a `/Job_Openings/{id}/associate`
2. Filtrar solo candidatos que existen en `candidates_kpi` (la Madre)
3. Upsert en `candidate_job_history_kpi` con `association_type='atraccion'`
4. Si el status cambió respecto a la fila anterior, insertar en `stage_history_kpi`

**Backfill (admin endpoint)**:
- `GET /api/admin/backfill-atraccion-history?limit=20&offset=0&dryRun=false`
- Procesa vacantes de atracción en lotes, cross-referencia con promo candidates
- Excluye vacantes BBDD (causan timeouts por tener miles de candidatos)

### 5.3 La estrategia vacancy-first

El endpoint de Zoho `GET /Candidates/{id}/Associate_Job_Openings` está roto (devuelve 204/vacío). Por tanto, es imposible preguntar "¿en qué vacantes estuvo este candidato?".

La solución: iterar vacantes atractivas → `/Job_Openings/{id}/associate` → hacer intersección con el set de candidatos de promo.

**Limitación**: solo cubre vacantes activas + las abiertas en los últimos 90 días. Vacantes muy antiguas pueden no estar en el historial.

### 5.4 Clasificación de retornados

En `src/lib/queries/formacion.ts`, función `getCandidatosConIntentos()`:

| Tipo | Criterio |
|------|---------|
| `primera_vez` | Exactamente 1 vacante de formación en el historial |
| `traslado` | 2+ vacantes de formación, gap entre primera y última ≤ 12 meses |
| `retornado` | 2+ vacantes de formación, gap > 12 meses (o fechas desconocidas) |

La clasificación se hace en memoria en JS porque Supabase client no soporta CTEs.

---

## 6. Dashboard — secciones

### 6.1 `/dashboard/atraccion`

Tabs: **Resumen** | **Vacantes** | **CVs recibidos** | **CVs cerradas**

**Resumen**:
- `CvsResumenCard`: totales de CVs (fuente: `vacancy_cv_weekly_kpi`)
- `ConversionRates`: tasas CV→Aprobado y Contactado→Aprobado. Fuente: `job_openings_kpi.total_candidates` + `vacancy_status_counts_kpi`. Excluye vacantes con `pais_destino='Interno'` por defecto.
- `WeeklyCVChart`: CVs por semana ISO (últimas 12 semanas). Fuente: `vacancy_cv_weekly_kpi`.
- `AttractionTrafficLights`: semáforos por promo activa (verde ≥100%, amarillo ≥90%, rojo <90%)
- `CharlasSummary`: resumen de charlas por temporada

**Vacantes**:
- `VacancyStatusCharts`: distribución de estados
- `VacancyRecruitmentTable`: vacantes activas con breakdown por status. Fuente: `job_openings_kpi` + `vacancy_status_counts_kpi`. Solo 26 de ~496 vacantes tienen datos en `vacancy_status_counts_kpi`.

**CVs recibidos**:
- `ReceivedCvsByVacancyView`: CVs semanales por vacante activa. Fuente: `vacancy_cv_weekly_kpi`.

**CVs cerradas**:
- `ClosedVacancyCvsView`: historial de CVs para vacantes cerradas. Fuente: `vacancy_cv_weekly_kpi` + `promo_job_link_kpi`.

**Limitaciones conocidas**:
- `vacancy_status_counts_kpi` solo tiene datos para ~26 vacantes (las que tienen el tag "Proceso Atracción Actual"). Las demás muestran byStatus vacío.
- `candidates_kpi.created_time` es NULL para todos los registros (el sync de Zoho nunca mapeó ese campo). La fuente correcta de CVs semanales es `vacancy_cv_weekly_kpi`.

### 6.2 `/dashboard/formacion`

Componentes principales:
- `RetentionOverview`: overview con filtro por promo (chips). Fuente: `candidates_kpi.current_status`
- `FormacionGraficos`: estados de formación, dropouts por razón/nivel/mes. Fuente: `candidates_kpi` + `promo_students_kpi`
- `PromoVacancyDistributionChart`: distribución de alumnos de una promo por vacante de atracción. Fuente: `candidate_job_history_kpi WHERE association_type='atraccion'`
- `PromoVacancyLinksManager`: UI para clasificar manualmente vacantes como atraccion/formacion por promo. CRUD en `promo_vacancy_links`
- Trayectoria de candidatos (primera_vez / traslado / retornado). Fuente: `candidate_job_history_kpi WHERE association_type='formacion'`
- `PromoVistaGeneral`: tabla de todas las promos con KPIs de atracción, programa, retención

**Subpágina `/dashboard/formacion/candidatos`**: lista de candidatos en formación con estado, promo, agencia, preferencias.

**Subpágina `/dashboard/formacion/sheets`**: registro y sync de Google Sheets por promo.

**Subpágina `/dashboard/formacion/abandonos`**: análisis de dropouts. Fuente: `promo_students_kpi WHERE tab_name='Dropouts'`.

**Estados de formación** (definidos en `formacion.ts`):
- Retenidos: Hired, Training Finished, In Training, Assigned, To Place, Next Project
- Abandonos: Offer Withdrawn, Offer Declined, Expelled, Transferred, Rejected by client, No Show

### 6.3 `/dashboard/promos`

Vista master-detail de promociones activas con datos en tiempo real.
- Cards con breakdown de status (Supabase Realtime subscriptions)
- Panel de detalle con timeline de candidatos
- Favoritos persistidos en `user_preferences_kpi`

Fuente: `promotions_kpi` + `candidates_kpi` + `candidate_job_history_kpi`. Realtime via Supabase channel.

### 6.4 `/dashboard/colocacion`

Principalmente placeholders con datos hardcodeados en el código. Incluye:
- Tabla de ofertas por cliente (datos mock)
- `GPColocacionView`: estado GP de candidatos — fuente: `candidates_kpi.gp_open_to`, `assigned_agency`
- Placeholders para billing y costes

### 6.5 `/dashboard/pipeline`

Vista clásica de pipeline por vacante. Selector de vacante → gráfico de distribución de status → tabla de candidatos con días en cada estado y alertas SLA.

Fuente: `job_openings_kpi` + `candidates_kpi` + SLA config de `dashboard_config_kpi`.

### 6.6 `/dashboard/configuracion`

- Gestión de Excel Madre sheets (registro, sync manual)
- Configuración de umbrales SLA por status

### 6.7 `/dashboard/analytics`

Métricas de tráfico web via Google Analytics 4 API. Fuente: `profession_url_mapping_kpi` + GA4.

### 6.8 `/dashboard/etiquetas`

Vista de tags de candidatos por vacante. Fuente: `vacancy_tag_counts_kpi`.

---

## 7. APIs y endpoints

### 7.1 Crons (`/api/cron/`)

| Endpoint | Método | Auth | Propósito |
|----------|--------|------|-----------|
| `/api/cron/sync` | GET | Bearer CRON_SECRET | Sync diario vacantes activas desde Zoho |
| `/api/cron/sync-full` | GET | Bearer CRON_SECRET | Sync semanal completo (6 fases) |
| `/api/cron/sync-madre` | GET | Bearer CRON_SECRET | Importa Excel Madre + hojas promo |
| `/api/cron/sync-social` | GET | Bearer CRON_SECRET | Snapshots YouTube |
| `/api/cron/sync-vacancy-cvs` | GET | Bearer CRON_SECRET | CVs semanales por vacante activa |
| `/api/cron/sync-placement` | GET | Bearer CRON_SECRET | Global Placement tab → candidates_kpi |
| `/api/cron/sync-atraccion-history` | GET | Bearer CRON_SECRET | Historial atracción para promo candidates |

### 7.2 Admin (`/api/admin/`)

| Endpoint | Método | Auth | Propósito | Params relevantes |
|----------|--------|------|-----------|-------------------|
| `/api/admin/backfill-atraccion-history` | GET | Público (admin) | Backfill histórico: atracción vacancies → promo candidates | `limit`, `offset`, `dryRun` |
| `/api/admin/sync-job-openings` | POST | x-api-key | Sync completo de vacantes Zoho | — |
| `/api/admin/sync-vacancy-stats` | POST | x-api-key | Agrega status counts por vacante activa → `vacancy_status_counts_kpi` | — |
| `/api/admin/sync-vacancy-cvs` | POST | x-api-key o auth | CVs semanales por vacante activa → `vacancy_cv_weekly_kpi` | — |
| `/api/admin/sync-vacancy-cvs-historical` | POST | x-api-key | Sync histórico de CVs (fuerza re-fetch de todas las semanas) | — |
| `/api/admin/sync-candidate-tags` | POST | x-api-key | Tags de candidatos desde Zoho → `candidates_kpi.tags` | — |
| `/api/admin/sync-vacancy-tags` | POST | x-api-key | Tags de vacantes (combo local + Zoho) → `vacancy_tag_counts_kpi` | — |
| `/api/admin/sync-vacancy-tags-local` | POST | x-api-key | Tags solo desde datos locales (sin API Zoho) | — |
| `/api/admin/sync-vacancy-tags-zoho` | POST | x-api-key | Tags desde Zoho API (solo vacantes activas) | — |
| `/api/admin/sync-social` | POST | x-api-key | Sync manual YouTube | — |
| `/api/admin/import-candidate-placement` | POST | x-api-key | Importa CSV de colocación de candidatos | `apply=1`, `syncCurrentStatus` |
| `/api/admin/import-charlas` | POST | x-api-key | Importa CSV de charlas/webinars | — |
| `/api/admin/debug-zoho-associate` | GET | Público (admin) | Inspecciona raw response de Zoho `/associate` | `vacancyId` |
| `/api/admin/vacancy-cv-target` | PATCH | Auth | Edita objetivo semanal de CVs por vacante | `vacancyId`, `target` |

### 7.3 Otros endpoints relevantes

| Endpoint | Propósito |
|----------|-----------|
| `/api/sheets/import-madre` | Importa Excel Madre manualmente |
| `/api/sheets/import-global-placement` | Importa Global Placement manualmente |
| `/api/sheets/sync` | Sync de hojas promo registradas |
| `/api/sync/job-openings` | Sync manual de vacantes |
| `/api/sync/status` | Estado del último sync |
| `/api/preferences/favorites` | GET/POST favoritos de promos del usuario |
| `/api/chat` | Chat AI con datos del dashboard |
| `/api/analytics/ga4` | Métricas GA4 |
| `/api/process/` | SLA pipeline: stats, snapshot, SLA days |

---

## 8. Problemas conocidos y limitaciones

### 8.1 Promos 114 y 116 — vacantes borradas de Zoho

- **Promo 114**: solo ~3% de coverage en `candidate_job_history_kpi`. La vacante de formación fue borrada de Zoho, por lo que el sync via `/associate` no la encuentra.
- **Promo 116**: 0% de coverage. Misma causa.
- **Impacto**: el análisis de trayectorias (primera_vez / traslado / retornado) para estas promos es incompleto.
- **No hay fix planificado** porque requeriría restaurar datos de Zoho o importarlos manualmente.

### 8.2 `vacancy_status_counts_kpi` — cobertura parcial

Solo ~26 de ~496 vacantes tienen datos en esta tabla. Son las que tienen el tag "Proceso Atracción Actual" en Zoho, que es lo que activa `es_proceso_atraccion_actual=true`.

El admin endpoint `/api/admin/sync-vacancy-stats` solo sincroniza vacantes activas (`es_proceso_atraccion_actual=true`). Las vacantes cerradas o sin el tag nunca tienen status counts.

**Impacto en UI**: la columna `byStatus` de las vacantes cerradas siempre estará vacía en `ClosedVacanciesData`.

### 8.3 Bug de Candidate_ID (corregido)

Históricamente, parte del código usaba `record.id` (ID largo de Zoho) para hacer matching contra `candidates_kpi.id`, que almacena el ID corto. Esto causaba que ningún candidato hiciera match.

**Fix**: siempre usar `record.Candidate_ID ?? record.id`. Está corregido en `sync-candidates.ts` y en el backfill. Si se vuelven a ver 0 matches en el backfill, revisar este punto primero.

### 8.4 Endpoint roto: `GET /Candidates/{id}/Associate_Job_Openings`

Este endpoint de Zoho Recruit v2 devuelve 204/vacío para todos los candidatos. Está confirmado roto.

**Consecuencia**: toda la lógica de historial de atracción usa la dirección opuesta (vacancy → candidates), lo que es más lento pero funciona.

### 8.5 BBDD excluidas del backfill y cron de atracción

Las vacantes con título que empieza por "BBDD" (bases de datos de talento) tienen miles de candidatos. Incluirlas en el backfill o en el cron semanal de historial causa timeouts de Vercel (300s).

**Fix**: todos los endpoints que iteran vacantes para cruzar con promo candidates aplican `.not('title', 'ilike', 'BBDD%')`.

**Implicación**: si algún candidato de promo estuvo asociado SOLO a una BBDD (sin otras vacantes de atracción), no tendrá registros de atracción en `candidate_job_history_kpi`.

### 8.6 `candidates_kpi.created_time` siempre NULL

El sync de Zoho nunca mapeó el campo `Created_Time` a esta columna. La función `getWeeklyCVCount()` (que usaba esta columna) produce datos incorrectos. La función correcta es `getWeeklyCVCountFromWeeklyTable()`, que lee de `vacancy_cv_weekly_kpi`.

### 8.7 Colocación es mayormente placeholder

La sección `/dashboard/colocacion` contiene datos hardcodeados en el componente (clientes con números de ejemplo). El modelo de datos para billing (`placement_billing_kpi`) y costes (`project_costs_kpi`) existe en schema pero no tiene datos ni UI funcional.

---

## 9. Ideas pendientes (de AGENTS.md)

### Idea 1 — Sistema de clasificación de vacantes: formación vs atracción

**Estado**: implementación parcial. La tabla `promo_vacancy_links` existe y tiene UI (`PromoVacancyLinksManager`). Falta:
- Que las queries de atracción filtren por `type='atraccion'` en esta tabla para excluir formación de métricas
- Calcular y mostrar tasas de éxito de formación por separado

**Concepto clave**: las vacantes de formación de Zoho son el mismo concepto que las promociones (`promotions_kpi`), pero guardadas en sistemas distintos. El puente es la capa de clasificación `promo_vacancy_links`.

**Tablas afectadas**: `promo_vacancy_links`, queries en `src/lib/queries/atraccion.ts`.

### Idea 2 — Gráfico de vacantes de atracción por promoción

**Estado**: implementado. El componente `PromoVacancyDistributionChart` ya muestra, para una promo seleccionada, cuántos alumnos estuvieron en cada vacante de atracción.

**Fuente de datos**: `candidates_kpi.promocion_nombre` × `candidate_job_history_kpi.job_opening_id WHERE association_type='atraccion'`.

**Función**: `getVacancyDistributionByPromo(promoNombre)` en `src/lib/queries/formacion.ts`.

---

## 10. Archivos de referencia rápida

### Documentación del proyecto

| Archivo | Propósito |
|---------|-----------|
| `SYSTEM.md` (este) | Fuente de verdad: modelo de datos, negocio, problemas conocidos |
| `AGENTS.md` | Instrucciones para agentes, reglas de contexto, ideas pendientes |
| `STRUCTURE.md` | Árbol completo de archivos, mapa de rutas, inventario de componentes y queries |
| `API-REFERENCE.md` | Todos los endpoints (51), crons (9), auth patterns, pipeline de datos |
| `INTEGRATIONS.md` | Integraciones: Zoho, Google Sheets, GA4, YouTube, OpenAI, Supabase |
| `INFRASTRUCTURE.md` | Config, middleware, env vars, migraciones DB, dependencias |

### Archivos de código clave

| Archivo | Propósito |
|---------|-----------|
| `src/lib/utils/vacancy-type.ts` | `deriveTipoVacante()` — lógica de clasificación atraccion/formacion |
| `src/lib/utils/vacancy-profession.ts` | `deriveProfesionTipo()` — tipo de profesional por título |
| `src/lib/zoho/client.ts` | Cliente Zoho API: `fetchJobOpenings`, `fetchAllCandidatesByJobOpening`, `fetchAssociatedJobOpeningsForCandidate` |
| `src/lib/zoho/transform.ts` | `transformJobOpening`, `transformCandidate` — mapeo de campos Zoho → DB |
| `src/lib/zoho/sync-candidates.ts` | `syncCandidatesForActiveVacancies` — sync diario de historial + stage history |
| `src/lib/zoho/sync-job-openings.ts` | `syncJobOpenings(mode)` — sync de vacantes |
| `src/lib/queries/atraccion.ts` | Todas las queries del dashboard de Atracción |
| `src/lib/queries/formacion.ts` | Todas las queries del dashboard de Formación (incluye retornados) |
| `src/app/api/admin/backfill-atraccion-history/route.ts` | Backfill manual de historial (vacancy-first approach) |
| `src/app/api/cron/sync-atraccion-history/route.ts` | Cron semanal de historial de atracción |
| `vercel.json` | Schedule de todos los crons |
| `supabase/migrations/` | 33 migraciones — historia completa del schema |
