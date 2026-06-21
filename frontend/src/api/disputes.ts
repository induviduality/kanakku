import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api-client'

export interface DuplicateTxnSummary {
  id: string
  type: string
  transacted_at: string
  amount: string
  currency: string
  description: string | null
  account_id: string
  account_name: string | null
  payee_id: string | null
  payee_name: string | null
}

export interface PotentialDuplicateGroup {
  date: string
  amount: string
  transactions: DuplicateTxnSummary[]
}

export interface PotentialDuplicatesResponse {
  groups: PotentialDuplicateGroup[]
  total_groups: number
}

export function usePotentialDuplicates(from?: string, to?: string) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()

  return useQuery<PotentialDuplicatesResponse>({
    queryKey: ['potential-duplicates', from, to],
    queryFn: () => apiGet(`/transactions/potential-duplicates${qs ? '?' + qs : ''}`),
  })
}
