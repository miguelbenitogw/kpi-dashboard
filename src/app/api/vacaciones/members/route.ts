import { NextResponse } from 'next/server'
import { getAllTeamMembers, toggleMemberActive } from '@/lib/queries/vacaciones'

export async function GET() {
  try {
    const members = await getAllTeamMembers()
    return NextResponse.json(members)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { memberId, isActive } = await request.json()
    if (typeof memberId !== 'number' || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    await toggleMemberActive(memberId, isActive)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
