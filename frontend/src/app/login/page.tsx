import { Suspense } from 'react'
import AuthLayout from '@/components/layout/auth-layout'
import { LoginForm } from './login-form'

function LoginFallback() {
  return (
    <div className="flex min-h-[320px] w-full max-w-md items-center justify-center rounded-lg border bg-card shadow-lg text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  )
}
