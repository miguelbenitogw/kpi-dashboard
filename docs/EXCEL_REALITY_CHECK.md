# Excel Reality Check — 2026-04-17

> Verificación directa de los 4 Excel principales del sistema con Python/openpyxl.
> Reemplaza al KPI_MAPPING.md (que tenía drift).

Archivos analizados (todos verificados celda por celda, no inferidos):

1. `C:/Users/PC/Downloads/Cuadro de Mando GW.xlsx` — requerimientos cliente
2. `C:/Users/PC/Downloads/Proyectos Enfermería 2025-2026.xlsx` — **Excel Madre**
3. `C:/Users/PC/Downloads/Promoción 124 - Performance and Coordination - Norway Online January 26 (Sp).xlsx` — Excel por promo
4. `C:/Users/PC/Downloads/GP - Candidate.xlsx` — Global Placement

---

## Pipeline de datos (confirmado por el usuario 2026-04-17)

```
  [1] Zoho Recruit           [2] Zoho Recruit           [3] Excels por promo
  "vacante ATRACCIÓN"   →    "vacante RENDIMIENTO      (solo pestaña "Dropouts
  Candidate asociado,        Y COORDINACIÓN"            (abandonos)" importa)
  estados: First Call,       Candidato entrenado              │
  Associated, Approved…      + aparece en Excel Madre         ▼
          │                          │                  Info de abandonos:
          ▼                          ▼                  motivo, fecha,
     candidates                 candidates              nivel idioma, asistencia
     (current_status)           (+ enrichment de
                                 Base Datos/Resumen
                                 del Excel Madre)
```

Implicación: `candidates.current_status` puede reflejar el estado de la vacante
de atracción O de la de coordinación según el momento. Hay que documentar esto
y potencialmente separar en dos campos (`zoho_attraction_status` vs
`zoho_coordination_status`).

---

## 1. Cuadro de Mando GW — VERIFICADO (88 columnas, 1 pestaña)

Estado del mapping doc: **completo para columnas A–BW**. El mapping original
(KPI_MAPPING.md) ya cubría la mayoría. El resumen por sección:

| Sección | Rango | KPIs |
|---------|-------|------|
| **Atracción** | A–AL | WEB/RRSS (A–H), Instituciones (I–U), Reclutamiento (V–AE), Visión general (AF–AL) |
| **Formación** | AM–AY | Visión general (AM–AN), Estados x10 (AO–AX), Abandonos (AY) |
| **Colocación** | BA–BW | Preferencia x6 (BA–BF), Status x10 (BG–BP), Cliente (BQ), Facturación (BR–BW) |
| **Costes/Margen** | BY | Costes desglosados por proyecto |

**Notas del cliente en filas R4–R7** (requisitos clave, algunos aún no reflejados en UI):
- R4/AH: "Que tenga la posibilidad de cambiar fecha de inicio de la formación **y la cantidad de candidatos objetivo** desde la UI" — editable
- R5/AO, BA, BG: "Se debe incluir tanto el **nº como el %** para cada estado" — confirmar en grids
- R4/BA, BG: "Se necesita una definición de todos estos estados. Será necesario tener una **leyenda/tooltip**"
- R7/BY: "Hay que añadir un apartado de costes en el que los costes aparezcan **desglosados por proyecto**"

---

## 2. Excel Madre — VERIFICADO (12 pestañas)

### Pestañas realmente existentes (no 6 como decía el reporte del agente)

| Pestaña | Rows × Cols | Importada hoy | Comentario |
|---------|------------|---------------|------------|
| `Resumen` | 1003 × **54** | ✅ parcial | Solo se importan ~20 cols de 54. Estados por promo no se leen. |
| `Base Datos` | 397 × 15 | ✅ parcial | `quincena` y `mes_y_año_llegada` se mapean pero NO se persisten (no existen en `candidates`). |
| `Plan Enfermería 2025-2026` | 923 × **234** | ❌ NO | Gantt semanal de profesores × promoción. **Pérdida total**. |
| `Global Placement` | 382 × 27 | ✅ parcial | 7 de 27 columnas importadas. Faltan: `Kontaktperson`, `Status (Training)`, `Availability`, `Open to`, `Priority`, `Shots`, `Has Global Placement profile?`, `CV Norsk`, `Blind CV Norsk`. |
| `Pagos - Proyectos 20252026` | 1051 × **43** | ❌ NO | **NUEVO HALLAZGO**. Tiene fecha abandono, fase de abandono, precio/hora, horas cursadas, precio total. Fuente directa para **Costes/Margen (BY)** que estaba marcado como diferido. |
| `Organización equipo de coordina` | 593 × 182 | ❌ NO | Organización semanal coordinadores. |
| `Curso Desarrollo` | 837 × 29 | ❌ NO | **NUEVO HALLAZGO**. Sesiones formativas, asistencia, encuestas. |
| `PRUEBA - Organización equipo d` | 608 × 182 | — | Duplicado "prueba" — ignorar |
| `Vista filtro - Clientes/Candidatos/Promociones` | 1 × 1 | — | Vistas vacías (placeholders) |
| `Solo Pablo prueba sin valor` | 1024 × 57 | — | Test con `#REF!`/`#DIV/0!` — ignorar |

### Columnas reales del Resumen (headers R2)

```
Promoción | Modalidad | País | Coord. | Cliente | Fecha Inicio | Fecha Fin |
Objetivo aceptados | Total aceptados | % consecución aceptados |
Objetivo comienzan | Total comienzan | % consecución comienzan |
Expectativa finalizan | Total comienzan (retención) | Estimación % éxito |
Estimación personas finalizan | Total firman contrato |
% resp aceptados | % resp comienzan | ... (hasta 54 cols)
```

→ Bug: el importer `import-madre.ts` solo escribe `fecha_inicio/fecha_fin/objetivos/total_aceptados/total_programa/expectativa_finalizan`. **No persiste los estados distribuidos** (hired, training_finished, to_place, etc. del sheet Resumen — actualmente se obtienen por conteo desde `candidates` vía `syncPromotionsFromCandidates`).

### Gap crítico #1: Pagos - Proyectos 20252026

Headers verificados:
```
Nombre | Email | Teléfono | Perfil | Nº Promoción | Coordinador/a | Modalidad |
Estado | Fecha de viaje a Noruega | Fecha de inicio formación |
Fecha del abandono o expulsión | Fecha de respuesta al mail |
Fase en la que abandona | Condiciones de la fase |
Precio/hora (€/h) | Horas cursadas | Precio total (€) |
Promoción anterior cursada | Anexo firmado | Precio de esa formación
```

Esta pestaña es LA FUENTE para Costes/Margen (BY del Cuadro de Mando). El sistema
actual marca BY como "diferido sin fuente" — pero la fuente existe y es este tab.

---

## 3. Promo 124 — Pestaña Abandonos VERIFICADA

Sheet name: **` Dropouts (abandonos)`** (con espacio al inicio — importante).

Otras pestañas (el usuario dijo que solo interesa Abandonos, pero para referencia):
`Contact Information` · `Attendance` · `Planning 2026-2027` · `Performance` ·
`Assignments` · ` Dropouts (abandonos)`

### Columnas REALES de Abandonos vs schema `candidates` actual

| Col | Excel header | DB field actual | Estado |
|----|--------------|-----------------|--------|
| A | Name | `full_name` | ✅ mapeado |
| B | Group | `promocion_nombre` (implícito) | ⚠️ extracción manual |
| C | Status | `current_status` | ✅ |
| D | **Modality** | — | ❌ **FALTA** |
| E | **Start date** | — | ❌ **FALTA** (`candidates` tiene `fecha_fin_formacion` pero no start) |
| F | Dropout date | `dropout_date` | ✅ |
| G | **Days of training** | — | ❌ **FALTA** |
| H | Level of language they was in | `dropout_language_level` | ✅ |
| I | Reason for dropout | `dropout_reason` | ✅ |
| J | Group they are transferred to | `transferred_to` | ✅ |
| K | **Inform new coordinator** | — | ❌ **FALTA** |
| L | **Update Zoho (status and comments)** | — | ❌ **FALTA** (tracking status) |

**Observación importante**: `import.ts` lee tabs de Google Sheets por **gid numérico**
(KNOWN_GIDS.DROPOUTS), no por nombre de sheet. El `tab_name: 'Dropouts'` que aparece
en `promo_students` es un literal hardcoded al insertar — consistente, no es bug.
**El problema real es otro**: el importer actual **solo soporta Google Sheets**,
no archivos .xlsx locales. El archivo `Promoción 124 - Performance and
Coordination...xlsx` del usuario es un xlsx local, no una Google Sheet pública.
Para importarlo se necesita un nuevo parser que abra xlsx y matchee el sheet
por nombre (aceptando variantes: `' Dropouts (abandonos)'`, `'Dropouts'`, `'Abandonos'`).

---

## 4. GP - Candidate — VERIFICADO (14 pestañas)

| Pestaña | Rows × Cols | Importada | Comentario |
|---------|------------|-----------|------------|
| `Proy. 2526 Cont.` | 1036 × 76 | ❌ | Contactos proyectos activos |
| `Proy. 2526 Applic.` | 1038 × 73 | ❌ | Applications actuales |
| `Proy 2425 CONTACT (ORiG)` | 1038 × 49 | ❌ | Histórico 2024-2025 |
| `Proy 2425 APPLIC` | 1038 × **152** | ❌ | Histórico applications (aplica por vacante) |
| `SHOTS program` | 1099 × 23 | ❌ | Programa de vacunas/preparación |
| `AVTALE kommune` | 1038 × 30 | ❌ | Contratos con municipios |
| `Veteran candidates` | 8 × 26 | ❌ | Veteranos |
| `Ads short / Ads Long` | 1058 / **4492** × ~30 | ❌ | Ofertas de trabajo publicadas |
| `Contract sign` | 59 × 8 | ❌ | Firmas de contrato |
| `Kommune status` | 975 × 24 | ❌ | Estado por municipio |
| `Statistikk` | 1038 × 65 | ❌ | **Estadísticas semanales** — fuente para dashboards |
| `Presentasjon vikarbyrå` | 1011 × 26 | ❌ | Presentaciones a agencias |
| `Respuestas de formulario 1` | 1 × 2 | ❌ | Test |

**Lo que el importer `import-global-placement.ts` hace hoy**: solo lee el tab
`Global Placement` del Excel **Madre** (gid 1470777220 en Google Sheets) — **no lee
este archivo GP - Candidate.xlsx**. Son dos fuentes distintas no conectadas.

Esto explica por qué BA-BF (placement_preference) y BG-BP (placement_status)
aparecen vacíos aunque la columna existe en DB desde migration 008.

---

## Plan de fixes prioritizado

| # | Prioridad | Acción | Archivos |
|---|-----------|--------|----------|
| 1 | P0 | Migration 010: campos faltantes en `candidates` (dropout_*, quincena, mes_llegada, GP extras) | `supabase/migrations/010_*.sql` |
| 2 | P0 | Nuevo parser xlsx local para pestaña Abandonos (import.ts actual solo soporta Google Sheets por gid) | nuevo `src/lib/excel/import-promo-dropouts.ts` |
| 3 | P0 | Persistir `quincena` y `mes_y_año_llegada` en Base Datos import | `src/lib/google-sheets/import-madre.ts` |
| 4 | P1 | Nueva migration: tabla `pagos_proyecto` para pestaña Pagos | 011 |
| 5 | P1 | Parser xlsx local para Excel Madre (hoy solo Google Sheets) | nuevo `src/lib/excel/import-madre.ts` |
| 6 | P1 | Parser para pestaña Abandonos de cada promo (xlsx local) | nuevo `src/lib/excel/import-promo-dropouts.ts` |
| 7 | P2 | Persistir estados distribuidos del Resumen (no solo conteo derivado) | `import-madre.ts` |
| 8 | P2 | Importer real para GP - Candidate.xlsx | nuevo |
| 9 | P2 | Eliminar pestañas "PRUEBA" / "Solo Pablo prueba" del inventario conocido | doc |

---

## Memoria / decisiones del usuario

- 2026-04-17: pipeline candidato es **Zoho-Atracción → Zoho-Coordinación + Excel Madre → Excel por promo (solo Abandonos)**.
- 2026-04-17: Excel por promo tiene 6 pestañas pero **solo importa Abandonos**.
- 2026-04-16: Semáforo oficial: verde=obj cumplido, amarillo=-10%, rojo=-20%.
- 2026-04-16: Facturación/RRSS/Instituciones completa → diferido.
