import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">404 — Page not found</h1>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  )
}
