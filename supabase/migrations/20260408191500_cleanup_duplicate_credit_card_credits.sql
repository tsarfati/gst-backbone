WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        company_id,
        credit_card_id,
        transaction_date,
        COALESCE(post_date, DATE '1900-01-01'),
        ABS(COALESCE(amount, 0)),
        LOWER(TRIM(COALESCE(description, ''))),
        LOWER(TRIM(COALESCE(merchant_name, ''))),
        LOWER(TRIM(COALESCE(reference_number, ''))),
        LOWER(TRIM(COALESCE(category, ''))),
        LOWER(TRIM(COALESCE(transaction_type, '')))
      ORDER BY
        CASE WHEN journal_entry_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN invoice_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN receipt_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN matched_bill_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN matched_payment_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN matched_receipt_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN attachment_url IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN vendor_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN job_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN cost_code_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        COALESCE(updated_at, created_at) DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id
    ) AS duplicate_rank
  FROM public.credit_card_transactions
  WHERE COALESCE(imported_from_csv, false) = true
    AND LOWER(COALESCE(transaction_type, '')) IN ('credit', 'refund')
),
to_delete AS (
  SELECT id
  FROM ranked_duplicates
  WHERE duplicate_rank > 1
)
DELETE FROM public.credit_card_transactions
WHERE id IN (SELECT id FROM to_delete);
