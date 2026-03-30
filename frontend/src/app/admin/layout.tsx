import ShellLayout from '@/components/layout/shell-layout'
import { AdminGuard } from '@/components/layout/admin-guard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <ShellLayout>{children}</ShellLayout>
    </AdminGuard>
  )
}
