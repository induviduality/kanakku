import { Drawer, DrawerSection, DrawerRow } from '../Drawer'
import { type Transaction, type TransactionType } from '../../api/transactions'
import { useAccounts } from '../../api/accounts'
import { usePayees } from '../../api/payees'
import { useCategories } from '../../api/categories'
import { useTags } from '../../api/tags'
import { useGetBudgets } from '../../api/budgets'
import { useGetSplit } from '../../api/splits'

const TYPE_CLS: Record<TransactionType, string> = {
  expense:         'kk-chip kk-chip-negative',
  income:          'kk-chip kk-chip-positive',
  transfer:        'kk-chip kk-chip-neutral',
  opening_balance: 'kk-chip kk-chip-accent',
}

const TYPE_LABEL: Record<TransactionType, string> = {
  expense:         'expense',
  income:          'income',
  transfer:        'transfer',
  opening_balance: 'opening balance',
}

const SHARE_STATUS_CLS: Record<string, string> = {
  pending:  'kk-chip kk-chip-neutral',
  settled:  'kk-chip kk-chip-positive',
  forgiven: 'kk-chip kk-chip-accent',
}

function useLookupMaps() {
  const { data: accounts   = [] } = useAccounts()
  const { data: payees     = [] } = usePayees()
  const { data: categories = [] } = useCategories()
  const { data: tags       = [] } = useTags()
  const { data: budgets    = [] } = useGetBudgets(false)

  const accountMap  = Object.fromEntries(accounts.map(a  => [a.id,  a.name]))
  const payeeMap    = Object.fromEntries(payees.map(p    => [p.id,  p.name]))
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const tagMap      = Object.fromEntries(tags.map(t      => [t.id,  t.name]))
  const budgetMap   = Object.fromEntries(budgets.map(b   => [b.id,  b.name]))

  return { accountMap, payeeMap, categoryMap, tagMap, budgetMap }
}

interface Props {
  transaction: Transaction | null
  onClose: () => void
}

export function TransactionDrawer({ transaction: txn, onClose }: Props) {
  const { accountMap, payeeMap, categoryMap, tagMap, budgetMap } = useLookupMaps()
  const { data: split } = useGetSplit(txn?.split_id ?? null)

  const amount = txn ? parseFloat(txn.amount) : 0
  const isExpense        = txn?.type === 'expense'
  const isTransfer       = txn?.type === 'transfer'
  const isOpeningBalance = txn?.type === 'opening_balance'

  return (
    <Drawer open={!!txn} onClose={onClose} title={txn?.description ?? 'Transaction'}>
      {txn && (
        <div className="space-y-6 p-5">
          {/* Hero amount */}
          <div className="kk-panel text-center">
            <p className={`text-2xl font-bold kk-mono ${isExpense ? 'text-negative-dim' : isOpeningBalance ? 'text-accent' : 'text-positive-dim'}`}>
              {isExpense ? '−' : isTransfer ? '' : '+'}₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              {txn.currency !== 'INR' && (
                <span className="ml-1.5 text-sm font-normal text-fg-faint">{txn.currency}</span>
              )}
            </p>
            <div className="mt-2 flex justify-center">
              <span className={TYPE_CLS[txn.type]}>{TYPE_LABEL[txn.type]}</span>
            </div>
            <p className="mt-2 text-xs text-fg-faint">
              {new Date(txn.transacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              {' '}
              {new Date(txn.transacted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Core details */}
          <DrawerSection label="Details">
            <div className="kk-panel">
              <DrawerRow label="Account" value={accountMap[txn.account_id] ?? txn.account_id} />
              {txn.payee_id && (
                <DrawerRow label="Payee" value={payeeMap[txn.payee_id] ?? txn.payee_id} />
              )}
              {isTransfer && txn.to_account_id && (
                <DrawerRow label="To account" value={accountMap[txn.to_account_id] ?? txn.to_account_id} />
              )}
              {isTransfer && txn.to_amount && (
                <DrawerRow
                  label="To amount"
                  value={
                    <span className="kk-mono">
                      ₹{parseFloat(txn.to_amount).toLocaleString('en-IN')}
                      {txn.to_currency && txn.to_currency !== 'INR' && (
                        <span className="ml-1 text-fg-faint">{txn.to_currency}</span>
                      )}
                    </span>
                  }
                />
              )}
              {txn.payment_method_name && (
                <DrawerRow label="Payment method" value={txn.payment_method_name} />
              )}
              {txn.external_ref && (
                <DrawerRow
                  label="Ref / UTR"
                  value={<span className="kk-mono text-sm">{txn.external_ref}</span>}
                />
              )}
              {txn.description && (
                <DrawerRow label="Description" value={txn.description} />
              )}
            </div>
          </DrawerSection>

          {/* Categories */}
          {txn.category_ids.length > 0 && (
            <DrawerSection label="Categories">
              <div className="flex flex-wrap gap-1.5">
                {txn.category_ids.map(id => (
                  <span key={id} className="kk-chip kk-chip-accent">
                    {categoryMap[id] ?? id}
                  </span>
                ))}
              </div>
            </DrawerSection>
          )}

          {/* Tags */}
          {txn.tag_ids.length > 0 && (
            <DrawerSection label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {txn.tag_ids.map(id => (
                  <span key={id} className="kk-chip kk-chip-neutral">
                    {tagMap[id] ?? id}
                  </span>
                ))}
              </div>
            </DrawerSection>
          )}

          {/* Linked budgets */}
          {txn.budget_ids.length > 0 && (
            <DrawerSection label="Budgets">
              <div className="flex flex-wrap gap-1.5">
                {txn.budget_ids.map(id => (
                  <span key={id} className="kk-chip kk-chip-accent">
                    {budgetMap[id] ?? id.slice(0, 8) + '…'}
                  </span>
                ))}
              </div>
            </DrawerSection>
          )}

          {/* Split */}
          {split && (
            <DrawerSection label="Split">
              <div className="kk-panel space-y-2">
                {split.shares.map(share => (
                  <div key={share.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-fg-dim truncate">
                        {share.payee_id ? (payeeMap[share.payee_id] ?? share.payee_id.slice(0, 8) + '…') : 'You'}
                      </span>
                      <span className={SHARE_STATUS_CLS[share.status] ?? 'kk-chip kk-chip-neutral'}>
                        {share.status}
                      </span>
                    </div>
                    <span className="kk-mono text-sm text-fg shrink-0">
                      ₹{parseFloat(share.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                {split.notes && (
                  <p className="mt-2 text-xs text-fg-faint border-t border-border pt-2">{split.notes}</p>
                )}
              </div>
            </DrawerSection>
          )}

          {/* Notes */}
          {txn.notes && (
            <DrawerSection label="Notes">
              <p className="text-sm text-fg-dim">{txn.notes}</p>
            </DrawerSection>
          )}

          {/* Meta */}
          <DrawerSection label="Meta">
            <div className="kk-panel">
              <DrawerRow label="ID" value={<span className="kk-mono text-xs text-fg-faint">{txn.id}</span>} />
              <DrawerRow
                label="Created"
                value={new Date(txn.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              />
              {txn.updated_at !== txn.created_at && (
                <DrawerRow
                  label="Updated"
                  value={new Date(txn.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                />
              )}
              {txn.subscription_id && (
                <DrawerRow label="Subscription" value={<span className="kk-mono text-xs text-fg-faint">{txn.subscription_id.slice(0, 8) + '…'}</span>} />
              )}
              {txn.import_record_id && (
                <DrawerRow label="Import record" value={<span className="kk-mono text-xs text-fg-faint">{txn.import_record_id.slice(0, 8) + '…'}</span>} />
              )}
            </div>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  )
}
