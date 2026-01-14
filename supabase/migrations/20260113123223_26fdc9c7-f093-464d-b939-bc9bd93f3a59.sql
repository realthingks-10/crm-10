-- Fix incorrect last_contacted_at values in contacts table
-- Update to use the most recent email sent_at from email_history
UPDATE contacts c
SET last_contacted_at = subq.max_sent_at
FROM (
  SELECT contact_id, MAX(sent_at) as max_sent_at
  FROM email_history 
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) subq
WHERE c.id = subq.contact_id
  AND (c.last_contacted_at IS NULL OR c.last_contacted_at != subq.max_sent_at);

-- Fix incorrect last_contacted_at values in leads table
UPDATE leads l
SET last_contacted_at = subq.max_sent_at
FROM (
  SELECT lead_id, MAX(sent_at) as max_sent_at
  FROM email_history 
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id
) subq
WHERE l.id = subq.lead_id
  AND (l.last_contacted_at IS NULL OR l.last_contacted_at != subq.max_sent_at);

-- Fix incorrect last_contacted_at values in accounts table
UPDATE accounts a
SET last_contacted_at = subq.max_sent_at
FROM (
  SELECT account_id, MAX(sent_at) as max_sent_at
  FROM email_history 
  WHERE account_id IS NOT NULL
  GROUP BY account_id
) subq
WHERE a.id = subq.account_id
  AND (a.last_contacted_at IS NULL OR a.last_contacted_at != subq.max_sent_at);