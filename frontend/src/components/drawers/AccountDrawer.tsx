import { Drawer, DrawerSection, DrawerRow } from '../Drawer'
import { usePaymentMethods, usePatchAccount, type Account } from '../../api/accounts'

const TYPE_LABEL: Record<Account['type'], string> = {
  bank:        'Bank',
  cash:        'Cash',
  credit_card: 'Credit card',
  loan:        'Loan',
}

const PM_TYPE_LABEL: Record<string, string> = {
  debit_card:  'Debit card',
  netbanking:  'Netbanking',
  upi:         'UPI',
}

function PaymentMethodsList({ accountId }: { accountId: string }) {
  const { data: methods = [], isLoading } = usePaymentMethods(accountId)

  if (isLoading) return <div className="h-8 animate-pulse rounded bg-surface-2" />
  if (methods.length === 0) return <p className="text-xs text-fg-faint">No payment methods configured.</p>

  return (
    <div className="kk-panel divide-y divide-border p-0 overflow-hidden">
      {methods.map(pm => (
        <div key={pm.id} className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium text-fg">{pm.name}</p>
          <div className="flex items-center gap-2">
            <span className="kk-chip kk-chip-neutral">{PM_TYPE_LABEL[pm.type] ?? pm.type}</span>
            {!pm.is_active && <span className="kk-chip kk-chip-neutral">Inactive</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

interface Props {
  account: Account | null
  onClose: () => void
}

export function AccountDrawer({ account, onClose }: Props) {
  const patch    = usePatchAccount()
  const balance  = account ? parseFloat(account.current_balance) : 0
  const opening  = account ? parseFloat(account.opening_balance) : 0
  const isNeg    = balance < 0

  function toggleActive() {
    if (!account) return
    patch.mutate({ id: account.id, patch: { is_active: !account.is_active } })
  }

  return (
    <Drawer open={!!account} onClose={onClose} title={account?.name ?? 'Account'}>
      {account && (
        <div className="space-y-6 p-5">
          {/* Hero */}
          <div className="kk-panel space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-fg">{account.name}</p>
                <span className="kk-chip kk-chip-neutral mt-1">{TYPE_LABEL[account.type]}</span>
              </div>
              {!account.is_active && (
                <span className="kk-chip kk-chip-warning">Inactive</span>
              )}
            </div>
            <div>
              <p className="text-xs text-fg-muted">Current balance</p>
              <p className={`text-2xl font-bold kk-mono mt-0.5 ${isNeg ? 'text-negative-dim' : 'text-fg'}`}>
                {account.currency} {Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Details */}
          <DrawerSection label="Details">
            <div className="kk-panel">
              <DrawerRow label="Type"     value={TYPE_LABEL[account.type]} />
              <DrawerRow label="Currency" value={account.currency} />
              <DrawerRow
              label="Status"
              value={
                <button
                  onClick={toggleActive}
                  disabled={patch.isPending}
                  className={`kk-chip cursor-pointer transition-opacity disabled:opacity-50 ${account.is_active ? 'kk-chip-positive' : 'kk-chip-warning'}`}
                >
                  {account.is_active ? 'Active' : 'Inactive'}
                </button>
              }
            />
              <DrawerRow
                label="Opening balance"
                value={<span className="kk-mono">{account.currency} {opening.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
              />
              <DrawerRow
                label="Created"
                value={new Date(account.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              />
            </div>
          </DrawerSection>

          {/* Payment methods */}
          {account.type !== 'credit_card' && (
            <DrawerSection label="Payment methods">
              <PaymentMethodsList accountId={account.id} />
            </DrawerSection>
          )}
        </div>
      )}
    </Drawer>
  )
}
