import { Drawer } from '../Drawer'
import { SplitForm } from '../SplitForm'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (splitId: string) => void
}

export function CreateSplitDrawer({ open, onClose, onCreated }: Props) {
  return (
    <Drawer open={open} onClose={onClose} title="Create Split">
      {open && <SplitForm onClose={onClose} onSuccess={onCreated} />}
    </Drawer>
  )
}
