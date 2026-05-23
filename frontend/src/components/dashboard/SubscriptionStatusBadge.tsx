import type { ActiveSubscriptionItem } from '../../api/dashboard'

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-green-100 text-green-800',
  due_soon: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}
    >
      {label}
    </span>
  )
}
