-- Fix bill deletion issue - add DELETE policy for invoices
CREATE POLICY "Users can delete invoices for their company" 
ON invoices 
FOR DELETE 
USING (EXISTS (
  SELECT 1 
  FROM vendors v
  JOIN get_user_companies(auth.uid()) uc(company_id, company_name, role) ON (uc.company_id = v.company_id)
  WHERE v.id = invoices.vendor_id
));

-- Add job costing distribution fields to subcontracts table
ALTER TABLE subcontracts 
ADD COLUMN IF NOT EXISTS cost_distribution JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS total_distributed_amount NUMERIC DEFAULT 0;

-- Add comment to explain the cost_distribution field structure
COMMENT ON COLUMN subcontracts.cost_distribution IS 'Array of cost distribution objects: [{"job_id": "uuid", "cost_code_id": "uuid", "amount": number, "percentage": number}]';