import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { ReactNode } from 'react'

/**
 * Consistent wrapper for form fields: label + tooltip + input + optional description.
 * Pass the input/select as `children` to preserve full control over its props.
 */
export function FormField({
  label,
  tooltip,
  description,
  children,
  id,
}: {
  label: string
  tooltip?: string
  description?: string
  children: ReactNode
  id?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="inline-flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip content={tooltip} side="top" />}
      </Label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
