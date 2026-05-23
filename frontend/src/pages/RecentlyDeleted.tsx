import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import {
  useRecentlyDeleted,
  useRestoreItem,
  ENTITY_TYPE_LABELS,
  type DeletedItem,
} from '../api/recentlyDeleted'

const TABS = Object.keys(ENTITY_TYPE_LABELS)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ItemRow({ item, onRestore }: { item: DeletedItem; onRestore: () => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">{item.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">Deleted {formatDate(item.deleted_at)}</p>
      </div>
      <button
        type="button"
        onClick={onRestore}
        className="ml-3 shrink-0 text-xs font-medium text-violet-700 hover:text-violet-900 min-h-[44px] min-w-[44px] px-3"
      >
        Restore
      </button>
    </div>
  )
}

export default function RecentlyDeleted() {
  const [activeTab, setActiveTab] = useState('accounts')
  const { data, isLoading, error } = useRecentlyDeleted()
  const restore = useRestoreItem()

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-red-600">Failed to load recently deleted items.</div>
  }

  const allItems = data?.items ?? []
  const byType = TABS.reduce<Record<string, DeletedItem[]>>((acc, t) => {
    acc[t] = allItems.filter((i) => i.entity_type === t)
    return acc
  }, {})

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Recently Deleted</h1>
      <p className="text-sm text-gray-500 mb-4">
        Items deleted within the last 30 days. After 30 days they are permanently removed.
      </p>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none">
          {TABS.map((tab) => {
            const count = byType[tab]?.length ?? 0
            return (
              <Tabs.Trigger
                key={tab}
                value={tab}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:border-violet-600 border-gray-300 text-gray-600 hover:border-violet-400"
              >
                {ENTITY_TYPE_LABELS[tab]}
                {count > 0 && (
                  <span className="ml-1.5 bg-red-100 text-red-700 data-[state=active]:bg-violet-400 data-[state=active]:text-white rounded-full px-1.5 py-0.5 text-[10px]">
                    {count}
                  </span>
                )}
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>

        {TABS.map((tab) => (
          <Tabs.Content key={tab} value={tab}>
            {byType[tab]?.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                No deleted {ENTITY_TYPE_LABELS[tab].toLowerCase()} in the last 30 days.
              </p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {byType[tab]?.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onRestore={() => restore.mutate({ entityType: item.entity_type, id: item.id })}
                  />
                ))}
              </div>
            )}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  )
}
