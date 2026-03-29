export default function HealthCheck() {
  return (
    <div className="hidden" suppressHydrationWarning>
      {JSON.stringify({ status: 'ok' })}
    </div>
  )
}
