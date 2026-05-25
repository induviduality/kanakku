import type { ActiveSubscriptionItem } from '../../api/dashboard'

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'kk-chip kk-chip-positive',
  due_soon: 'kk-chip kk-chip-warning',
  overdue: 'kk-chip kk-chip-negative',
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming',
  due_soon: 'Due soon',
  overdue: 'Overdue',
}

export default function SubscriptionStatusBadge({ subscription }: { subscription: ActiveSubscriptionItem }) {
  const style = STATUS_STYLES[subscription.status] ?? STATUS_STYLES.upcoming
  const label = STATUS_LABEL[subscription.status] ?? subscription.status

  return (
    <span
      aria-label={`status: ${subscription.status}`}
      className={style}
    >
      {label}
    </span>
  )
}
