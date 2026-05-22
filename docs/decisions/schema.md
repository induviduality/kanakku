# Current Schema State (as of <milestone>)

Example (remove when you start writing data here):
transactions: id, user_id, type(expense/income/transfer), transacted_at, 
  amount, currency, account_id, payment_method_id?, payee_id?, 
  to_account_id?, to_amount?, to_currency?, subscription_id?, 
  import_record_id?, created_at, updated_at, deleted_at

splits: id, user_id, expense_transaction_id(UNIQUE FK), notes, timestamps
split_shares: id, split_id, payee_id?(null=user), amount, 
  status(pending/settled/forgiven), settlement_transaction_id?, timestamps

[continues per milestone...]