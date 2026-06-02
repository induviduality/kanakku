import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithQuery } from '../test/render-utils'
import { Drawer, DrawerSection, DrawerRow } from './Drawer'

describe('Drawer component', () => {
  it('renders Drawer when open is true', () => {
    renderWithQuery(
      <Drawer open={true} onClose={vi.fn()} title="Test Drawer">
        <div>Drawer Content</div>
      </Drawer>
    )
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Drawer')).toBeInTheDocument()
    expect(screen.getByText('Drawer Content')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    renderWithQuery(
      <Drawer open={false} onClose={vi.fn()} title="Test Drawer">
        <div>Drawer Content</div>
      </Drawer>
    )
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithQuery(
      <Drawer open={true} onClose={onClose} title="Test Drawer">
        <div>Drawer Content</div>
      </Drawer>
    )
    
    const closeBtn = screen.getByRole('button', { name: /close/i })
    await user.click(closeBtn)
    
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders DrawerSection properly', () => {
    renderWithQuery(
      <DrawerSection label="Section Label">
        <p>Section Content</p>
      </DrawerSection>
    )
    
    expect(screen.getByText('Section Label')).toBeInTheDocument()
    expect(screen.getByText('Section Content')).toBeInTheDocument()
  })

  it('renders DrawerRow properly', () => {
    renderWithQuery(
      <DrawerRow label="Row Label" value="Row Value" />
    )
    
    expect(screen.getByText('Row Label')).toBeInTheDocument()
    expect(screen.getByText('Row Value')).toBeInTheDocument()
  })
})
