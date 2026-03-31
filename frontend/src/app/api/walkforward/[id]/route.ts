import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { id } = await params

  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${backendUrl}/walkforward/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch walkforward' }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
