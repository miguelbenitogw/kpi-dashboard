import { NextResponse } from 'next/server'
import { listSheets, readSheetByGid } from '@/lib/google-sheets/client'

// Test spreadsheet: Promo 113/114
const SPREADSHEET_ID = '1Gb22VO_gLRKdCgLOYL_1llJCAt-AwZhcF9QXsbWprik'
const DROPOUT_GID = 1646413473

export async function GET() {
  try {
    // 1. List all tabs
    const tabs = await listSheets(SPREADSHEET_ID)

    // 2. Read first 3 rows of the dropout tab
    const rows = await readSheetByGid(SPREADSHEET_ID, DROPOUT_GID)

    return NextResponse.json({
      ok: true,
      tabs,
      rowCount: rows.length,
      sample: rows.slice(0, 2),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
