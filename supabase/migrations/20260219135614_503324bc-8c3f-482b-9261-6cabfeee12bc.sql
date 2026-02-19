
-- Create 5 missing contacts from deals data
INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Jagdish Mishra', 'REFU Drive', created_by FROM deals WHERE lead_name = 'Jagdish Mishra' LIMIT 1;

INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Jonatan Rydberg', 'Coretura', created_by FROM deals WHERE lead_name = 'Jonatan Rydberg' LIMIT 1;

INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Leif Frendin', 'Volvo AB', created_by FROM deals WHERE lead_name = 'Leif Frendin' LIMIT 1;

INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Pradip Mukherjee', 'CARIAD US', created_by FROM deals WHERE lead_name = 'Pradip Mukherjee' LIMIT 1;

INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Simon Burghard', 'Eberspächer', created_by FROM deals WHERE lead_name = 'Simon Burghard' LIMIT 1;

-- Fix misspelled lead_names in deals
UPDATE deals SET lead_name = 'Tobias Gründl' WHERE lead_name = 'Tobias Gruendl';
UPDATE deals SET lead_name = 'Ritesh Mehta' WHERE lead_name = 'Ritesh Metha';
