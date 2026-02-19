
-- Migrate existing lead records into deals table as 'Lead' stage
-- The leads table is NOT modified - data stays there for safety
-- Only insert leads that don't already exist as Lead-stage deals (by lead_name + customer_name match)

INSERT INTO deals (
  deal_name,
  stage,
  project_name,
  customer_name,
  lead_name,
  region,
  internal_comment,
  created_by,
  created_at,
  modified_at,
  lead_owner
)
SELECT
  COALESCE(l.lead_name, l.company_name, 'Unnamed') AS deal_name,
  'Lead' AS stage,
  COALESCE(l.lead_name, l.company_name, 'Unnamed') AS project_name,
  l.company_name AS customer_name,
  l.lead_name AS lead_name,
  l.country AS region,
  l.description AS internal_comment,
  l.created_by,
  COALESCE(l.created_time, now()) AS created_at,
  COALESCE(l.created_time, now()) AS modified_at,
  COALESCE(p.full_name, '') AS lead_owner
FROM leads l
LEFT JOIN profiles p ON p.id = l.created_by
WHERE NOT EXISTS (
  SELECT 1 FROM deals d
  WHERE d.lead_name = l.lead_name
    AND d.stage = 'Lead'
    AND d.created_by = l.created_by
);
