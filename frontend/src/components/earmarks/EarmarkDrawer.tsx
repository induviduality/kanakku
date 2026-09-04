import { useState, useEffect } from 'react'
import { Trash2, Check, Power } from 'lucide-react'
import { Drawer } from '../Drawer'
import {
  useGetEarmark,
  useCreateEarmark,
  usePatchEarmark,
  useToggleEarmark,
  useDeleteEarmark,
} from '../../api/earmarks'
import { useAccounts, type Account } from '../../api/accounts'
import { useGetPiggyBanks, type PiggyBank } from '../../api/piggy_banks'
import ConfirmDialog from '../ConfirmDialog'
import { useToast } from '../../lib/toast'

interface Props {
  open: boolean
  earmarkId: string | null
  onClose: () => void
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#EF4444', // Red
]

export function EarmarkDrawer({ open, earmarkId, onClose }: Props) {
  const { data: earmark, isLoading } = useGetEarmark(earmarkId)
  const { data: accounts = [] } = useAccounts()
  const { data: piggyBanks = [] } = useGetPiggyBanks()

  const createEarmark = useCreateEarmark()
  const patchEarmark = usePatchEarmark()
  const toggleEarmark = useToggleEarmark()
  const deleteEarmark = useDeleteEarmark()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [accountId, setAccountId] = useState<string>('')
  const [piggyBankId, setPiggyBankId] = useState<string>('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [notes, setNotes] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isEdit = !!earmarkId

  // Only allow non-liability asset accounts (bank, cash)
  const assetAccounts = accounts.filter(
    (a: Account) => a.type === 'bank' || a.type === 'cash'
  )

  useEffect(() => {
    if (earmark && isEdit) {
      setName(earmark.name)
      setAmount(earmark.amount)
      setCurrency(earmark.currency)
      setAccountId(earmark.account_id ?? '')
      setPiggyBankId(earmark.piggy_bank_id ?? '')
      setIcon(earmark.icon ?? '')
      setColor(earmark.color ?? PRESET_COLORS[0])
      setNotes(earmark.notes ?? '')
    } else if (!isEdit) {
      setName('')
      setAmount('')
      setCurrency('INR')
      setAccountId('')
      setPiggyBankId('')
      setIcon('')
      setColor(PRESET_COLORS[0])
      setNotes('')
    }
  }, [earmark, isEdit, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('Please enter a name.', 'error')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast('Amount must be positive.', 'error')
      return
    }

    if (isEdit && earmarkId) {
      patchEarmark.mutate(
        {
          id: earmarkId,
          patch: {
            name: name.trim(),
            amount: amount,
            currency,
            account_id: accountId ? accountId : null,
            piggy_bank_id: piggyBankId ? piggyBankId : null,
            icon: icon.trim() || null,
            color,
            notes: notes.trim() || null,
          },
        },
        {
          onSuccess: () => {
            toast('Earmark updated.')
            onClose()
          },
          onError: (err: any) => {
            const detail = err?.response?.data?.detail || 'Failed to update earmark.'
            toast(detail, 'error')
          },
        }
      )
    } else {
      createEarmark.mutate(
        {
          name: name.trim(),
          amount: amount,
          currency,
          account_id: accountId ? accountId : null,
          piggy_bank_id: piggyBankId ? piggyBankId : null,
          icon: icon.trim() || null,
          color,
          notes: notes.trim() || null,
        },
        {
          onSuccess: () => {
            toast('Earmark created.')
            onClose()
          },
          onError: (err: any) => {
            const detail = err?.response?.data?.detail || 'Failed to create earmark.'
            toast(detail, 'error')
          },
        }
      )
    }
  }

  const handleToggle = () => {
    if (!earmarkId) return
    toggleEarmark.mutate(earmarkId, {
      onSuccess: (updated) => {
        toast(updated.is_active ? 'Earmark activated.' : 'Earmark paused.')
      },
      onError: (err: any) => {
        const detail = err?.response?.data?.detail || 'Failed to toggle earmark.'
        toast(detail, 'error')
      },
    })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? (earmark?.name ?? 'Edit Earmark') : 'New Earmark'}
    >
      {isEdit && isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {/* Active status banner for existing earmark */}
          {isEdit && earmark && (
            <div className="kk-panel flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    earmark.is_active ? 'bg-positive' : 'bg-fg-faint'
                  }`}
                />
                <span className="text-xs font-medium text-fg">
                  {earmark.is_active ? 'Active Earmark' : 'Paused / Inactive'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggle}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-dim transition-colors"
              >
                <Power className="w-3.5 h-3.5" />
                {earmark.is_active ? 'Pause' : 'Activate'}
              </button>
            </div>
          )}

          {/* Basic info */}
          <div className="space-y-4">
            <div>
              <label className="kk-label block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Emergency Fund, Laptop Savings"
                className="kk-input w-full"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="kk-label block mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-faint kk-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="kk-input w-full pl-7 kk-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="kk-label block mb-1">Currency</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="kk-input w-full uppercase"
                  maxLength={5}
                  required
                />
              </div>
            </div>

            {/* Optional Links */}
            <div>
              <label className="kk-label block mb-1">
                Account <span className="text-fg-faint text-[11px]">(Optional tag)</span>
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="kk-input w-full"
              >
                <option value="">General (No account tag)</option>
                {assetAccounts.map((acc: Account) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-fg-faint mt-1">
                Conceptually links this earmark to an account. Real balance is not reduced.
              </p>
            </div>

            <div>
              <label className="kk-label block mb-1">
                Savings Goal / Piggy Bank{' '}
                <span className="text-fg-faint text-[11px]">(Optional)</span>
              </label>
              <select
                value={piggyBankId}
                onChange={(e) => setPiggyBankId(e.target.value)}
                className="kk-input w-full"
              >
                <option value="">None</option>
                {piggyBanks
                  .filter((p: PiggyBank) => p.currency === currency)
                  .map((pig: PiggyBank) => (
                    <option key={pig.id} value={pig.id}>
                      {pig.name} (Target: ₹{parseFloat(pig.target_amount).toLocaleString('en-IN')})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-fg-faint mt-1">
                Directly funds this goal without requiring a transfer transaction.
              </p>
            </div>

            {/* Customization: Icon & Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="kk-label block mb-1">Icon / Emoji</label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g. 🛡️, 💻, ✈️"
                  className="kk-input w-full text-center"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="kk-label block mb-1">Color Tag</label>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="kk-label block mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or context..."
                rows={2}
                className="kk-input w-full resize-none"
              />
            </div>
          </div>

          {/* Form buttons */}
          <div className="pt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={createEarmark.isPending || patchEarmark.isPending}
              className="kk-btn kk-btn-primary flex-1 py-2.5"
            >
              {isEdit ? 'Save changes' : 'Create Earmark'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="kk-btn kk-btn-secondary py-2.5"
            >
              Cancel
            </button>
          </div>

          {/* Delete action for edit mode */}
          {isEdit && earmark && (
            <div className="pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1.5 text-xs text-negative-dim hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete earmark
              </button>
            </div>
          )}
        </form>
      )}

      {isEdit && earmark && (
        <ConfirmDialog
          open={deleteOpen}
          title="Delete Earmark"
          description={`Delete "${earmark.name}"? The earmarked amount will be released back to available cash. This can be undone within 30 days.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={() => {
            deleteEarmark.mutate(earmark.id, {
              onSuccess: () => {
                setDeleteOpen(false)
                onClose()
                toast('Earmark deleted.')
              },
              onError: () => toast('Failed to delete earmark. Please try again.', 'error'),
            })
          }}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </Drawer>
  )
}
