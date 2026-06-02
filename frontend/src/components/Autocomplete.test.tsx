import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Autocomplete, { type AutocompleteOption } from './Autocomplete'

describe('Autocomplete component', () => {
  const options: AutocompleteOption[] = [
    { id: 'opt-1', label: 'Apple' },
    { id: 'opt-2', label: 'Banana' },
    { id: 'opt-3', label: 'Cherry' },
  ]

  it('renders input, displays options on focus, and handles selection', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Autocomplete
        options={options}
        value={null}
        onChange={handleChange}
        placeholder="Choose fruit"
      />
    )

    const input = screen.getByPlaceholderText('Choose fruit')
    expect(input).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    // Focus input to open listbox
    await user.click(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)

    // Select Banana
    await user.click(screen.getByText('Banana'))
    expect(handleChange).toHaveBeenCalledWith('opt-2')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('filters options based on search query', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        options={options}
        value={null}
        onChange={vi.fn()}
      />
    )

    const input = screen.getByRole('combobox')
    await user.type(input, 'ap')
    
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument()
  })

  it('handles clearing selected value', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Autocomplete
        options={options}
        value="opt-2"
        onChange={handleChange}
      />
    )

    const clearButton = screen.getByRole('button', { name: /clear/i })
    expect(clearButton).toBeInTheDocument()

    await user.click(clearButton)
    expect(handleChange).toHaveBeenCalledWith(null)

    // Rerender with null to simulate parent update
    rerender(
      <Autocomplete
        options={options}
        value={null}
        onChange={handleChange}
      />
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('supports inline creation', async () => {
    const user = userEvent.setup()
    const handleInlineCreate = vi.fn().mockResolvedValue({ id: 'opt-new', label: 'Dragonfruit' })
    const handleChange = vi.fn()

    render(
      <Autocomplete
        options={options}
        value={null}
        onChange={handleChange}
        onInlineCreate={handleInlineCreate}
      />
    )

    const input = screen.getByRole('combobox')
    await user.type(input, 'Dragonfruit')

    const createOption = screen.getByText('Create "Dragonfruit"')
    expect(createOption).toBeInTheDocument()

    await user.click(createOption)
    expect(handleInlineCreate).toHaveBeenCalledWith('Dragonfruit')
    await waitFor(() => expect(handleChange).toHaveBeenCalledWith('opt-new'))
  })

  it('closes dropdown and resets query on outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <div data-testid="outside">Outside Element</div>
        <Autocomplete
          options={options}
          value="opt-1"
          onChange={vi.fn()}
        />
      </div>
    )

    const input = screen.getByRole('combobox') as HTMLInputElement
    await user.click(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.type(input, 'pple juice')
    expect(input.value).toBe('Applepple juice')

    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input.value).toBe('Apple')
  })
})
