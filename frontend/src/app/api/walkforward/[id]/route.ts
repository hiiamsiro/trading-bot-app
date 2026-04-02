import { NextRequest, NextResponse } from 'next/server'

function getBackendUrl(): string {
  // Server-side (Next.js SSR/Route Handler):
  //   In Docker, localhost inside the Next.js container != backend.
  //   Use host.docker.internal so SSR fetch reaches the backend container.
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  // Fallback for Docker: host.docker.internal:3001
  // Fallback for local dev: localhost:3001
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
  const res = await fetch(`${backendUrl}/walkforward/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch walkforward' }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
