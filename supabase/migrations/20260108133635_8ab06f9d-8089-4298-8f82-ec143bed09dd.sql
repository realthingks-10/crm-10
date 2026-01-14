-- Clean up old action_item notifications (legacy data from 5+ months ago)
DELETE FROM notifications WHERE notification_type = 'action_item';

-- Update any notifications referencing action_item_id to have null (orphan cleanup)
UPDATE notifications SET action_item_id = NULL WHERE action_item_id IS NOT NULL;