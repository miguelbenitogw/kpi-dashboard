/**
 * scripts/sync-vacancy-tags-zoho.ts
 *
 * Standalone script — no Supabase dependency.
 *
 * 1. Pre-fetches ALL Zoho candidates → Map<18-digit-id → tags[]>
 * 2. For each of the 495 vacancies, fetches associated candidates via
 *    GET /Job_Openings/{id}/associate and counts tags
 * 3. Outputs INSERT SQL to stdout; redirect to a file and execute via Supabase MCP
 *
 * Usage:
 *   npx tsx scripts/sync-vacancy-tags-zoho.ts \
 *     > scripts/vacancy-tags.sql \
 *     2> scripts/vacancy-tags-progress.txt
 *
 * Then paste scripts/vacancy-tags.sql into Supabase MCP execute_sql.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Load env ─────────────────────────────────────────────────────────────────
function loadEnv(filename: string): boolean {
  try {
    const content = readFileSync(resolve(process.cwd(), filename), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const raw = trimmed.slice(eqIdx + 1).trim()
      const val = raw.replace(/^["']|["']$/g, '')
      if (key && !(key in process.env)) process.env[key] = val
    }
    return true
  } catch {
    return false
  }
}

if (!loadEnv('.env.production-local')) {
  if (!loadEnv('.env.local')) {
    process.stderr.write('⚠ Could not load .env.production-local or .env.local\n')
  } else {
    process.stderr.write('ℹ Loaded .env.local\n')
  }
} else {
  process.stderr.write('ℹ Loaded .env.production-local\n')
}

// ── Vacancy IDs (495 total: 211 active + 284 closed) ─────────────────────────
const ACTIVE_VACANCIES: string[] = [
  '179458000001761016','179458000002307005','179458000002426016','179458000002439039',
  '179458000002764996','179458000003256452','179458000003399175','179458000003573006',
  '179458000003573015','179458000003806283','179458000003839245','179458000003839260',
  '179458000003842371','179458000003884484','179458000003973568','179458000003987261',
  '179458000004079393','179458000004559354','179458000005369038','179458000005476145',
  '179458000006502038','179458000006664046','179458000007108001','179458000007321010',
  '179458000007327041','179458000007327064','179458000007684010','179458000007936001',
  '179458000008212265','179458000008254170','179458000008410079','179458000008412203',
  '179458000009044476','179458000009044489','179458000009326014','179458000009360044',
  '179458000010144042','179458000010176405','179458000010179006','179458000010179023',
  '179458000010179046','179458000010179063','179458000010203187','179458000010263098',
  '179458000010412322','179458000012146235','179458000012211021','179458000012378039',
  '179458000012399041','179458000012741149','179458000012741162','179458000013338001',
  '179458000013817292','179458000014048048','179458000014397006','179458000014592001',
  '179458000015034044','179458000015072372','179458000015072382','179458000015205001',
  '179458000015367005','179458000016534010','179458000016927001','179458000017341162',
  '179458000017424043','179458000017504569','179458000017555847','179458000017840151',
  '179458000017941057','179458000017962001','179458000018094009','179458000018094166',
  '179458000018094518','179458000018363199','179458000018413019','179458000018446009',
  '179458000018448022','179458000018511125','179458000018953013','179458000019152403',
  '179458000019344506','179458000019580108','179458000019593001','179458000019688021',
  '179458000019765087','179458000019765925','179458000020114001','179458000020156395',
  '179458000020509026','179458000020509064','179458000020509088','179458000020509110',
  '179458000020509134','179458000020509158','179458000020509200','179458000020509222',
  '179458000020509257','179458000020509267','179458000020675001','179458000020741009',
  '179458000020885306','179458000020885596','179458000021260181','179458000021458325',
  '179458000021482053','179458000021605140','179458000021722143','179458000021916081',
  '179458000022252255','179458000022343129','179458000022397039','179458000022500005',
  '179458000022691011','179458000022851789','179458000022931441','179458000023214102',
  '179458000023225045','179458000023309165','179458000023370017','179458000023440322',
  '179458000023440339','179458000023451005','179458000023468001','179458000023580233',
  '179458000023585025','179458000023717155','179458000023784273','179458000023842044',
  '179458000024020036','179458000024071083','179458000024233035','179458000024334718',
  '179458000024666026','179458000024725253','179458000024799289','179458000024879005',
  '179458000025031534','179458000025098767','179458000025098789','179458000025243001',
  '179458000025290678','179458000025443001','179458000025449008','179458000025451063',
  '179458000025452073','179458000025487191','179458000025493100','179458000025520029',
  '179458000025520042','179458000025800031','179458000025917049','179458000025966001',
  '179458000025982012','179458000025999128','179458000026363011','179458000026397357',
  '179458000026397395','179458000026397408','179458000026971021','179458000027086005',
  '179458000027265568','179458000027265945','179458000027380107','179458000027486017',
  '179458000027646728','179458000027942378','179458000028028855','179458000028028904',
  '179458000028038334','179458000028104021','179458000028236131','179458000028252032',
  '179458000028273532','179458000028297037','179458000028316700','179458000028425118',
  '179458000028478692','179458000028522001','179458000028532055','179458000028597116',
  '179458000028649149','179458000028766506','179458000028785019','179458000028819269',
  '179458000028963103','179458000029018034','179458000029271029','179458000029272013',
  '179458000029295069','179458000029297015','179458000029394033','179458000029394927',
  '179458000029403223','179458000029516167','179458000029542102','179458000029634484',
  '179458000029657357','179458000029814039','179458000030127146','179458000030356129',
  '179458000030444664','179458000030485049','179458000030533224','179458000030737001',
  '179458000030801157','179458000030850005','179458000030855587','179458000030901049',
  '179458000030980015','179458000030993046','179458000030993056',
]

const CLOSED_VACANCIES: string[] = [
  '179458000001387093','179458000001436020','179458000001651367','179458000001671225',
  '179458000001673032','179458000001673090','179458000001825003','179458000001832013',
  '179458000001832074','179458000001929071','179458000001929283','179458000002094009',
  '179458000002111001','179458000002148001','179458000002148086','179458000002156021',
  '179458000002179007','179458000002179084','179458000002184196','179458000002194058',
  '179458000002195508','179458000002206003','179458000002222027','179458000002292024',
  '179458000002315003','179458000002321083','179458000002324008','179458000002324121',
  '179458000002324296','179458000002341014','179458000002354017','179458000002360031',
  '179458000002360105','179458000002367093','179458000002381914','179458000002384249',
  '179458000002388218','179458000002404003','179458000002416080','179458000002452702',
  '179458000002452786','179458000002452881','179458000002452948','179458000002493840',
  '179458000002509514','179458000002556936','179458000002609178','179458000002615001',
  '179458000002644409','179458000002647722','179458000002647786','179458000002737009',
  '179458000002775014','179458000003083001','179458000003170606','179458000003170677',
  '179458000003315054','179458000003385134','179458000003397017','179458000003642596',
  '179458000003693172','179458000003806272','179458000003806307','179458000003810214',
  '179458000003810265','179458000003810341','179458000004011001','179458000004327317',
  '179458000004544001','179458000004553014','179458000004553117','179458000004559161',
  '179458000004559316','179458000004559333','179458000004559375','179458000004675457',
  '179458000004700117','179458000004700261','179458000004764016','179458000004986030',
  '179458000005020007','179458000005027027','179458000005055078','179458000005250001',
  '179458000005466051','179458000005548005','179458000005553792','179458000005588092',
  '179458000005799009','179458000005981001','179458000006282001','179458000006321809',
  '179458000006341020','179458000006364122','179458000006467057','179458000006470190',
  '179458000006567558','179458000006581525','179458000006643010','179458000006666556',
  '179458000006668010','179458000006675888','179458000006753676','179458000006905657',
  '179458000007490027','179458000007524074','179458000007530016','179458000007530034',
  '179458000007530047','179458000007566227','179458000007603045','179458000007612037',
  '179458000007612236','179458000007627174','179458000007665023','179458000007704009',
  '179458000007772218','179458000007855163','179458000008016411','179458000008092501',
  '179458000008101064','179458000008116188','179458000008213400','179458000008287380',
  '179458000008318680','179458000008326981','179458000008460680','179458000008667334',
  '179458000008753706','179458000009044512','179458000009124053','179458000009200270',
  '179458000009263180','179458000009326001','179458000009683072','179458000009759086',
  '179458000009759127','179458000009957049','179458000009988009','179458000009988129',
  '179458000010042001','179458000010180001','179458000010180020','179458000010180039',
  '179458000010180058','179458000010180077','179458000010180096','179458000010413023',
  '179458000010440001','179458000010588201','179458000010668095','179458000010668108',
  '179458000010675330','179458000011365151','179458000011556119','179458000011869406',
  '179458000011879563','179458000012002007','179458000012236412','179458000012236431',
  '179458000012236450','179458000012464136','179458000012528118','179458000012825251',
  '179458000013113054','179458000013215001','179458000013215176','179458000013341070',
  '179458000013343015','179458000013587030','179458000013587043','179458000013835449',
  '179458000013835478','179458000013935053','179458000013976001','179458000014342001',
  '179458000014473156','179458000014473169','179458000014544055','179458000014558054',
  '179458000014667293','179458000014791010','179458000014791345','179458000015229051',
  '179458000015772095','179458000015912005','179458000015912015','179458000016003158',
  '179458000016363001','179458000016363011','179458000016396011','179458000016418001',
  '179458000016742001','179458000016928683','179458000016928837','179458000017007105',
  '179458000017223720','179458000017280198','179458000017498022','179458000017504043',
  '179458000017621003','179458000017952159','179458000018139033','179458000018342086',
  '179458000018523011','179458000018658517','179458000018658535','179458000018861165',
  '179458000018919264','179458000019116041','179458000019260287','179458000019365021',
  '179458000020609006','179458000020813017','179458000021419115','179458000021419163',
  '179458000021442013','179458000021486145','179458000021549483','179458000021638001',
  '179458000021736175','179458000021749001','179458000021755280','179458000022032128',
  '179458000022129114','179458000022275460','179458000022409155','179458000022512205',
  '179458000022528057','179458000022658665','179458000022730308','179458000023551322',
  '179458000023713039','179458000023790157','179458000023882009','179458000024315097',
  '179458000024357035','179458000024408017','179458000024440019','179458000024651370',
  '179458000025008337','179458000025204044','179458000025314141','179458000025319088',
  '179458000025487209','179458000025655019','179458000026208027','179458000026270487',
  '179458000026393227','179458000027115007','179458000027288003','179458000027382331',
  '179458000027426001','179458000027614063','179458000027757101','179458000028198076',
  '179458000028357554','179458000028449322','179458000028468073','179458000028572022',
  '179458000028659225','179458000028798011','179458000028819288','179458000029265257',
  '179458000029483197','179458000029734056','179458000029786270','179458000029811257',
  '179458000029833090','179458000029856116','179458000029856187','179458000029856200',
  '179458000029856217','179458000029878588','179458000030262005','179458000030499077',
  '179458000030604085','179458000030604123','179458000030604136','179458000030737119',
  '179458000030766458','179458000030766478','179458000030808095','179458000030970001',
]

const ALL_VACANCIES = [...ACTIVE_VACANCIES, ...CLOSED_VACANCIES]

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function getZohoToken(): Promise<string> {
  const { ZOHO_TOKEN_URL, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN } = process.env
  if (!ZOHO_TOKEN_URL || !ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error(
      'Missing Zoho env vars: ZOHO_TOKEN_URL, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN'
    )
  }
  const res = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: ZOHO_REFRESH_TOKEN,
    }).toString(),
  })
  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''")
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const base = (process.env.ZOHO_API_BASE_URL ?? '').replace(/\/$/, '')
  if (!base) throw new Error('Missing env var: ZOHO_API_BASE_URL')

  // ── Step 1: Get token ───────────────────────────────────────────────────────
  process.stderr.write('🔑 Getting Zoho token...\n')
  const token = await getZohoToken()
  process.stderr.write('✓ Token OK\n')

  // ── Step 2: Pre-fetch ALL candidates → Map<18-digit-id → tags[]> ────────────
  process.stderr.write('\n📥 Pre-fetching all Zoho candidates (id + Associated_Tags)...\n')
  const candidateTagMap = new Map<string, string[]>()
  let candPage = 1
  let candHasMore = true
  let candTotal = 0

  while (candHasMore) {
    const url = new URL(`${base}/Candidates`)
    url.searchParams.set('fields', 'Associated_Tags')
    url.searchParams.set('per_page', '200')
    url.searchParams.set('page', String(candPage))

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })

    if (res.status === 204) {
      process.stderr.write(`  Page ${candPage}: no more records (204)\n`)
      break
    }
    if (!res.ok) {
      throw new Error(`Candidates fetch failed — page ${candPage}: HTTP ${res.status} ${await res.text()}`)
    }

    const body = (await res.json()) as {
      data?: Record<string, unknown>[]
      info?: { more_records?: boolean }
    }

    const records = body.data ?? []
    candTotal += records.length
    candHasMore = body.info?.more_records ?? false

    for (const r of records) {
      const zohoId = String(r.id ?? '')
      if (!zohoId) continue
      const rawTags = r.Associated_Tags as
        | Array<string | { name: string }>
        | null
        | undefined
      const tags = (rawTags ?? [])
        .map((t) => (typeof t === 'string' ? t : ((t as { name: string }).name ?? '')))
        .filter(Boolean)
      if (tags.length > 0) {
        candidateTagMap.set(zohoId, tags)
      }
    }

    process.stderr.write(
      `  Page ${candPage}: ${records.length} records — ${candidateTagMap.size} candidates with tags so far\n`
    )
    candPage++
    if (candHasMore) await sleep(200)
  }

  process.stderr.write(
    `✓ ${candTotal} candidates fetched — ${candidateTagMap.size} have tags\n`
  )

  // ── Step 3: For each vacancy fetch associated candidates & count tags ────────
  process.stderr.write(
    `\n🏢 Processing ${ALL_VACANCIES.length} vacancies (${ACTIVE_VACANCIES.length} active + ${CLOSED_VACANCIES.length} closed)...\n`
  )

  type TagRow = { vacancy_id: string; tag: string; count: number }
  const allRows: TagRow[] = []
  const errors: string[] = []
  let processed = 0
  let withTags = 0

  for (const vacancyId of ALL_VACANCIES) {
    try {
      const tagCounts = new Map<string, number>()
      let assocPage = 1
      let assocHasMore = true

      while (assocHasMore) {
        const assocUrl = new URL(`${base}/Job_Openings/${vacancyId}/associate`)
        assocUrl.searchParams.set('per_page', '200')
        assocUrl.searchParams.set('page', String(assocPage))

        const assocRes = await fetch(assocUrl.toString(), {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        })

        if (assocRes.status === 204) {
          break // no candidates
        }
        if (!assocRes.ok) {
          const body = await assocRes.text()
          errors.push(
            `Vacancy ${vacancyId} p${assocPage}: HTTP ${assocRes.status} — ${body.slice(0, 120)}`
          )
          break
        }

        const assocBody = (await assocRes.json()) as {
          data?: Record<string, unknown>[]
          info?: { more_records?: boolean }
        }

        const candidates = assocBody.data ?? []
        assocHasMore = assocBody.info?.more_records ?? false

        for (const c of candidates) {
          const zohoId = String(c.id ?? '')
          if (!zohoId) continue
          for (const tag of candidateTagMap.get(zohoId) ?? []) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
          }
        }

        assocPage++
        if (assocHasMore) await sleep(200)
      }

      if (tagCounts.size > 0) {
        for (const [tag, count] of tagCounts) {
          allRows.push({ vacancy_id: vacancyId, tag, count })
        }
        withTags++
      }

      processed++
      if (processed % 50 === 0 || processed === ALL_VACANCIES.length) {
        process.stderr.write(
          `  [${processed}/${ALL_VACANCIES.length}] ${withTags} vacancies with tags — ${allRows.length} rows so far\n`
        )
      }
    } catch (err) {
      errors.push(
        `Vacancy ${vacancyId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Rate limit: 200ms between vacancy calls
    await sleep(200)
  }

  process.stderr.write(`\n✓ Processed: ${processed}/${ALL_VACANCIES.length}\n`)
  process.stderr.write(`✓ Vacancies with tag data: ${withTags}\n`)
  process.stderr.write(`✓ Total tag rows: ${allRows.length}\n`)

  if (errors.length > 0) {
    process.stderr.write(`\n⚠ ${errors.length} errors:\n`)
    for (const e of errors) process.stderr.write(`  - ${e}\n`)
  }

  if (allRows.length === 0) {
    process.stderr.write('\n❌ No tag rows to insert — exiting without SQL output\n')
    return
  }

  // ── Step 4: Emit SQL in batches of 500 rows ──────────────────────────────────
  const BATCH = 500
  const now = new Date().toISOString()

  process.stderr.write(
    `\n📝 Emitting SQL (${allRows.length} rows, batches of ${BATCH})...\n`
  )

  process.stdout.write(`-- vacancy_tag_counts_kpi sync\n-- Generated: ${now}\n-- ${allRows.length} rows across ${withTags} vacancies\n\n`)

  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH)
    const values = batch
      .map(
        (r) =>
          `('${escapeSql(r.vacancy_id)}','${escapeSql(r.tag)}',${r.count},'${now}')`
      )
      .join(',\n  ')

    process.stdout.write(
      `INSERT INTO vacancy_tag_counts_kpi (vacancy_id, tag, count, synced_at)\nVALUES\n  ${values}\nON CONFLICT (vacancy_id, tag)\nDO UPDATE SET\n  count = EXCLUDED.count,\n  synced_at = EXCLUDED.synced_at;\n\n`
    )
  }

  process.stderr.write('✅ Done — SQL written to stdout\n')
}

main().catch((err) => {
  process.stderr.write(`\n💥 Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
