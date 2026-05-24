interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 text-fg-muted">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs mt-1 text-fg-faint">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
