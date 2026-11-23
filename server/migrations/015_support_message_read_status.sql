ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS user_read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS support_messages_owner_unread_idx
  ON support_messages(ticket_id, created_at DESC)
  WHERE sender_type = 'owner' AND user_read_at IS NULL;
