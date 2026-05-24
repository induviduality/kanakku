import { Drawer, DrawerSection, DrawerRow } from '../Drawer'
import { type Payee } from '../../api/payees'

const TYPE_LABEL: Record<Payee['type'], string> = {
  merchant: 'Merchant',
  person:   'Person',
  business: 'Business',
  other:    'Other',
}

interface Props {
  payee: Payee | null
  onClose: () => void
}

export function PayeeDrawer({ payee, onClose }: Props) {
  return (
    <Drawer open={!!payee} onClose={onClose} title={payee?.name ?? 'Payee'}>
      {payee && (
        <div className="space-y-6 p-5">
          {/* Hero */}
          <div className="kk-panel flex items-center gap-4">
            <div className="kk-icon-box h-10 w-10 rounded-lg">
              <span className="text-lg font-bold text-fg-dim">
                {payee.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-fg">{payee.name}</p>
              <span className="kk-chip kk-chip-neutral mt-1">{TYPE_LABEL[payee.type]}</span>
            </div>
          </div>

          {/* Details */}
          <DrawerSection label="Details">
            <div className="kk-panel">
              <DrawerRow label="Type" value={TYPE_LABEL[payee.type]} />
              <DrawerRow label="Status" value={payee.is_active ? 'Active' : 'Inactive'} />
              {payee.notes && <DrawerRow label="Notes" value={payee.notes} />}
              <DrawerRow
                label="Added"
                value={new Date(payee.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              />
            </div>
          </DrawerSection>

          {payee.default_category_ids.length > 0 && (
            <DrawerSection label="Default categories">
              <p className="text-xs text-fg-faint">{payee.default_category_ids.length} configured</p>
            </DrawerSection>
          )}
        </div>
      )}
    </Drawer>
  )
}
