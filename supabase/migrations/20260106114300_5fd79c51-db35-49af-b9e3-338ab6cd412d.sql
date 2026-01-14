-- Add missing page permissions for Meetings and Tasks
INSERT INTO page_permissions (page_name, route, description, admin_access, manager_access, user_access)
VALUES 
  ('Meetings', '/meetings', 'View and manage meetings', true, true, true),
  ('Tasks', '/tasks', 'View and manage tasks', true, true, true)
ON CONFLICT (route) DO NOTHING;