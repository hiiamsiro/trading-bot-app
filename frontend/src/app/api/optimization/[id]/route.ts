import { NextRequest, NextResponse } from 'next/server'

// Always fetch fresh data — optimization progress updates in real-time
export const dynamic = 'force-dynamic'

function getBackendUrl(): string {
  // Server-side: use host.docker.internal so SSR fetch reaches the backend container
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://host.docker.internal:3001'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { id } = await params

  const backendUrl = getBackendUrl()
  const res = await fetch(`${backendUrl}/optimization/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch optimization' }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
