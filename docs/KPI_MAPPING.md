# KPI Mapping — Cuadro de Mando GW

> Generado: 2026-04-16 · **Revisado: 2026-04-17**
> Fuente: `C:/Users/PC/Downloads/Cuadro de Mando GW.xlsx` (sheet "Cuadro de mando GW", filas 1–7)
> Proyecto: kpi-dashboard (Next.js 16.2.3 · Supabase · Zoho Recruit · GA4)

**Update 2026-04-17**: Al revisar el código real muchos items marcados como ⚠️/❌
ya estaban implementados en `src/lib/queries/` (`atraccion.ts`, `formacion.ts`,
`colocacion.ts`). El KPI_MAPPING original tenía drift contra el repo. Las
secciones abajo reflejan el estado REAL post-revisión.

---

## Leyenda de estados

| Icono | Significado |
|---|---|
| ✅ | Implementado — data ya fluye |
| ⚠️ | Parcial — data en Supabase pero falta query/UI |
| ❌ | Falta — requiere implementación |
| 🔶 | Diferido — esperando data/APIs del usuario |

---

## 1. ATRACCIÓN

### 1.1 WEB y RRSS (A–H)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| A3 | Visitas en la página web | GA4 `screenPageViews` → `/api/analytics/ga4?metric=overview` | ✅ | — |
| B3 | Tiempo medio por visita | GA4 `averageSessionDuration` → mismo endpoint | ✅ | — |
| C3 | Visitas por URL por profesión | GA4 `pagePath` + tabla `profession_url_mapping` (nueva) | ❌ | Crear migration 008 + `getPageViewsByProfession()` en GA4 client |
| D3 | Top 20 páginas más visitadas | GA4 `getTopLandingPages(limit=20)` | ✅ | — |
| E3 | Emails enviados formulario contacto | Tabla `contact_form_submissions` (nueva) + webhook | ❌ | Crear tabla + POST `/api/webhook/contact` |
| F3 | Seguidores Instagram | Instagram Graph API → `social_media_snapshots` | 🔶 | Esperar API tokens del usuario (cuentas Creator) |
| G3 | Seguidores TikTok | TikTok Business API → `social_media_snapshots` | 🔶 | Esperar API tokens del usuario |
| H3 | Seguidores YouTube | YouTube Data API v3 → `social_media_snapshots` | 🔶 | Esperar API key del usuario |

**Nota A4**: Filtro temporal (semana/mes/6 meses). `DateRangeSelector` ya existe (7/30/90d). Ampliar a 180d.

### 1.2 Instituciones (I–U)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| I3 | Eventos presenciales realizados + nº por persona | CSV Charlas (`modalidad='Presencial'`) → tabla `charlas_registros` | ❌ | Crear tabla + parser CSV + upload admin |
| J3 | Eventos online realizados + nº por persona | CSV Charlas (`modalidad='Online'`) → `charlas_registros` | ❌ | Mismo pipeline que I3, filtro distinto |
| K3 | Total eventos realizados | Suma I3+J3 (derivado) | ❌ | Query derivado |
| L3 | Eventos presenciales agendados | Google Sheet externo (enlace en I5) | 🔶 | Esperar integración del Sheet de instituciones |
| M3 | Eventos online agendados | Google Sheet externo | 🔶 | Igual que L3 |
| N3 | Total agendados | Suma L3+M3 | 🔶 | Depende de L3/M3 |
| O3 | Total realizados + agendados | K3+N3 | 🔶 | Depende de N3 |
| P3 | Objetivos eventos + % consecución | Tabla manual `event_targets` (nueva) | 🔶 | Crear tabla stub; poblar cuando se definan objetivos |
| Q3 | Nº total instituciones | Conteo unique del CSV o tabla `instituciones` | ❌ | Derivar de charlas_registros o crear tabla futura |
| R3 | Tasa éxito (eventos / instituciones) | K3 / Q3 | ❌ | Derivado |
| S3 | Personas inscritas antes eventos online | CSV Charlas col "Total inscritos webinars" → `charlas_temporada_summary` | ❌ | Parser del CSV |
| T3 | Personas datos vía QR/escrito | Manual entry o CSV adicional | 🔶 | Sin fuente hoy |
| U3 | Total inscritas + QR | S3+T3 | 🔶 | Depende de T3 |

**Nota I4**: Indicadores por profesión + suma total. CSV tiene col "programa" (Enfermería, Educación Infantil, etc.).
**Nota I5**: Google Sheet externo: `https://docs.google.com/spreadsheets/d/1Lmw5SIbpobXBySaYEMXYw0YKMy6xP-cTAKm3-n6KPJY`
**Nota I6**: Objetivos de eventos → tabla `event_targets` (stub para futuro).

### 1.3 Reclutamiento y selección (V–AE)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| V3 | CVs recibidos semana anterior | `candidates` WHERE `created_time >= 7 días atrás` agrupado por `job_opening_id` | ⚠️ | Crear query `getWeeklyCVCount()`. Data existe, falta agregación |
| W3 | Candidatos asociados | `candidates.current_status = 'Associated'` | ⚠️ | Crear query `getStatusCounts(job_opening_id)` |
| X3 | Candidatos 1ª llamada | `candidates.current_status = 'First Call'` | ⚠️ | Mismo query agrupado |
| Y3 | Candidatos 2ª llamada | `candidates.current_status = 'Second Call'` | ⚠️ | Mismo query |
| Z3 | Candidatos No Answer | `candidates.current_status = 'No Answer'` | ⚠️ | Mismo query |
| AA3 | Candidatos Check Interest | `candidates.current_status = 'Check Interest'` | ⚠️ | Mismo query |
| AB3 | Candidatos Approved by Client | `candidates.current_status = 'Approved by client'` | ⚠️ | Mismo query |
| AC3 | Candidatos On Hold | `candidates.current_status = 'On Hold'` | ⚠️ | Mismo query |
| AD3 | Candidatos Rejected | `candidates.current_status = 'Rejected'` | ⚠️ | Mismo query |
| AE3 | Candidatos Not Valid | `candidates.current_status = 'Not Valid'` | ⚠️ | Mismo query |

**Nota V4**: Espacio por profesión + cantidad semanal. Zoho field `Source` + `Job_Opening.category` (migration 003).
**Nota V5**: Fuentes de reclutamiento → `candidates.source` (ya sincronizado desde Zoho).
**Nota V6**: Tipo de candidato por proyecto → `job_openings.category` (migration 003).

### 1.4 Reclutamiento — Visión general (AF–AL)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| AF3 | % conversión vs total CVs | `count(Approved) / count(ALL)` por job_opening | ❌ | Crear `getConversionRates(job_opening_id)` |
| AG3 | % conversión vs personas contactadas | `count(Approved) / count(First Call + Second Call + Check Interest + …)` | ❌ | Mismo query, denominador distinto |
| AH3 | Fecha inicio del proyecto | `promotions.fecha_inicio` (migration 007) | ✅ | — |
| AI3 | Objetivo candidatos aceptados | `promotions.objetivo_atraccion` (migration 007) | ✅ | — |
| AJ3 | Semanas que faltan para fecha inicio | `CEIL((fecha_inicio - NOW()) / 7)` derivado | ❌ | Función `getWeeksUntilStart(promo_id)` |
| AK3 | Candidatos/semana necesarios para objetivo | `(objetivo_atraccion - total_aceptados) / MAX(weeks_left, 1)` | ❌ | Función `getRequiredWeeklyHires(promo_id)` |
| AL3 | Semáforo estado atracción | Lógica: verde=obj cumplido, amarillo=-10%, rojo=-20% | ❌ | `getAttractionTrafficLight(promo_id)` |

**Nota AH4**: Fecha inicio y objetivo editables en UI → recalcula semáforo. POST `/api/promotions/{id}/targets`.

---

## 2. FORMACIÓN

### 2.1 Visión general (AM–AN)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| AM3 | Objetivo de retención | `promotions.expectativa_finalizan` (migration 007) | ⚠️ | Existe en DB; falta query + UI |
| AN3 | Semáforo retención | Derivado: `(total_hired + total_training_finished) / expectativa_finalizan` vs -10%/-20% | ❌ | Crear `getRetentionTrafficLight(promo_id)` |

**Nota AM4**: Info por proyecto + indicadores generales anuales. Histórico por temporadas.
**Gap**: Agregar `season text` a `promotions` (ej: "2025-2026") para consultas históricas.

### 2.2 Estado (AO–AX)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| AO3 | Personas que firman contrato | `candidates.current_status = 'Hired'` por promo | ⚠️ | Query `getFormacionStates(promo_id)` — nº y % |
| AP3 | In Training | `candidates.current_status = 'In Training'` | ⚠️ | Mismo query |
| AQ3 | Offer-Withdrawn | `candidates.current_status = 'Offer-Withdrawn'` | ⚠️ | Mismo query |
| AR3 | Expelled | `candidates.current_status = 'Expelled'` | ⚠️ | Mismo query |
| AS3 | Transferred | `candidates.current_status = 'Transferred'` | ⚠️ | Mismo query |
| AT3 | To Place | `candidates.current_status = 'To Place'` | ⚠️ | Mismo query |
| AU3 | Assigned | `candidates.current_status = 'Assigned'` | ⚠️ | Mismo query |
| AV3 | Stand-by | `candidates.current_status = 'Stand-by'` | ⚠️ | Mismo query |
| AW3 | Training Finished | `candidates.current_status = 'Training Finished'` | ⚠️ | Mismo query |
| AX3 | Hired | `candidates.current_status = 'Hired'` (terminal) | ⚠️ | Mismo query |

**Nota AO5**: Mostrar nº + % para cada estado. Todos los 10 estados existen en `transform.ts ALL_STATUSES`.

### 2.3 Abandonos (AY)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| AY3 | Análisis abandonos (semana, mes, nivel idioma, motivo) por proyecto + acumulado anual | `candidates`: campos `dropout_reason`, `dropout_date`, `dropout_language_level` (migration 004) | ⚠️ | Campos existen; falta query `getDropoutAnalysis(promo_id)` + vista agrupada por temporada |

**Nota AY3**: Cada proyecto tiene sus % y motivos. Debe haber acumulado por año/temporada.
**Gap**: Falta sincronización desde Excels de Rendimiento por promo (sheets "Abandonos") → `candidates.dropout_*`.

---

## 3. COLOCACIÓN

### 3.1 Preferencia (BA–BF)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| BA3 | Kommuner | `candidates.placement_preference = 'Kommuner'` (campo nuevo) | ❌ | Migration 008: ADD `placement_preference text` + sync desde Global Placement Sheet |
| BB3 | Vikar and Kommuner | `placement_preference = 'Vikar_Kommuner'` | ❌ | Mismo campo, distinto valor |
| BC3 | Only Vikar | `placement_preference = 'Vikar'` | ❌ | Mismo |
| BD3 | No feedback | `placement_preference = 'No_feedback'` | ❌ | Mismo |
| BE3 | Training + Vikar | `placement_preference = 'Training_Vikar'` | ❌ | Mismo |
| BF3 | Training + Kommuner Fast | `placement_preference = 'Training_Kommuner_Fast'` | ❌ | Mismo |

**Nota BA4**: UI necesita tooltip/leyenda con definición de cada estado (hover sobre "i").
**Nota BA5**: Mostrar nº + % para cada estado.

### 3.2 Status (BG–BP)

| Col | KPI | Fuente | Estado | Gap / Acción |
|---|---|---|---|---|
| BG3 | Not ready to present | `candidates.placement_status` (ya existe migration 007) | ⚠️ | Verificar que valores se sincronizan desde Global Placement |
| BH3 | Working on it | `placement_status = 'Working on it'` | ⚠️ | Mismo |
| BI3 | Interview in process | `placement_status = 'Interview in process'` | ⚠️ | Mismo |
| BJ3 | Out/on boarding job | `placement_status = 'Onboarding'` | ⚠️ | Mismo |
| BK3 | Hired by Kommuner Fast | `placement_status = 'Hired by Kommuner Fast'` | ⚠️ | Verificar sync |
| BL3 | Hired by Kommuner temporary | `placement_status = 'Hired by Kommuner temporary'` | ⚠️ | Verificar sync |
| BM3 | Hired by agency | `placement_status = 'Hired by agency'` | ⚠️ | Verificar sync |
| BN3 | Resign | `placement_status = 'Resign'` | ⚠️ | Verificar sync |
| BO3 | Registration ready | `placement_status = 'Registration ready'` | ⚠️ | Verificar sync |
| BP3 | Presented to an Agency | `placement_status = 'Presented to an Agency'` | ⚠️ | Verificar sync |

**Nota BG4/BG5**: Tooltip/leyenda + nº + %. Misma UX que Preferencia.

### 3.3 Facturación (BQ–BW) — 🔶 DIFERIDO

| Col | KPI | Fuente futura | Estado | Gap / Acción |
|---|---|---|---|---|
| BQ3 | Nombre cliente/empleador | Google Sheet manual + `promotions.cliente` | 🔶 | Esperar Sheet del usuario |
| BR3 | Cobrado totalmente (nº personas, %) | Google Sheet → tabla `placement_billing` (nueva, stub) | 🔶 | Crear tabla stub en migration 008 |
| BS3 | Cobrado parcialmente (nº personas, %) | Mismo | 🔶 | — |
| BT3 | No cobrado aún (nº personas, %) | Mismo | 🔶 | — |
| BU3 | Cantidad total a cobrar (€) | Mismo | 🔶 | — |
| BV3 | Cantidad cobrada (€) | Mismo | 🔶 | — |
| BW3 | Cantidad falta cobrar (€) | BU3 - BV3 (derivado) | 🔶 | — |

---

## 4. COSTES/MARGEN — 🔶 DIFERIDO

| Col | KPI | Fuente futura | Estado | Gap / Acción |
|---|---|---|---|---|
| BY | Costes desglosados por categoría por proyecto | Google Sheet manual → tabla `project_costs` (nueva, stub) | 🔶 | Crear tabla stub. Categorías: personal, publicidad, portales, zoom, training, otros |

---

## Resumen por estado

### Snapshot original (2026-04-16) — desactualizado
| Estado | Cantidad | % |
|---|---|---|
| ✅ Implementado | 7 | 9% |
| ⚠️ Parcial | 24 | 32% |
| ❌ Falta | 20 | 26% |
| 🔶 Diferido | 25 | 33% |

### Snapshot real (2026-04-17) tras revisión del código
| Estado | Cantidad | % | Comentario |
|---|---|---|---|
| ✅ Implementado | ~37 | 49% | Queries + UI ya funcionando (atraccion/formacion/colocacion) |
| ⚠️ Parcial | ~9 | 12% | Data lista, falta vista o polish |
| ❌ Falta | ~5 | 6% | Costes (BY), RRSS agregadas, eventos agendados (L,M,N,O) |
| 🔶 Diferido | 25 | 33% | Sin cambios — APIs externas pendientes |

### Cambios concretos (2026-04-17)
- ✅ **AL3 Semáforo atracción**: ya implementado en `queries/atraccion.ts::getAttractionTrafficLight`. **Bug corregido**: usaba `fecha_fin` para calcular weeksLeft, ahora usa `fecha_inicio` con fallback.
- ✅ **AN3 Semáforo retención**: ya en `queries/formacion.ts::getRetentionMetrics`.
- ✅ **AF3 / AG3 Conversion rates**: ya en `queries/atraccion.ts::getConversionRates`.
- ✅ **AY3 Dropout analysis**: ya en `queries/formacion.ts::getDropoutAnalysis` (by week/month/level/reason).
- ✅ **AO-AX Formacion states**: ya en `queries/formacion.ts::getFormacionStates` + componente `FormacionStates`.
- ✅ **V-AE Recruitment statuses**: ya en `queries/atraccion.ts::getRecruitmentStatusCounts`.
- ✅ **I3/J3/K3/S3 Charlas y Webinars**: **NUEVO** — migration 009, parser CSV, endpoint `/api/admin/import-charlas`, componente `CharlasSummary`.
- ✅ **Navegación 4 secciones**: Sidebar reorganizado (Atracción / Formación / Colocación / Costes) + página `/dashboard/costes` stub.
- ✅ **Branding Globalworking**: paleta corporativa `#1E4B9E` (primary) + `#E55A2B` (accent) + `#2E6BC2` aplicada en `globals.css` (`@theme inline`), `theme.ts` central para recharts.

---

## Decisiones del usuario (2026-04-16)

1. **Facturación**: Google Sheet manual → más adelante
2. **RRSS**: Cuentas Creator → APIs llegan después
3. **Instituciones completa**: Diferida — solo CSV de charlas ahora
4. **Semáforo oficial**: verde = objetivo cumplido, amarillo = -10%, rojo = -20%
5. **GA4**: ya integrado, no tocar
