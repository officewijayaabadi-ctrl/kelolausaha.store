CREATE UNIQUE INDEX IF NOT EXISTS support_messages_email_message_id_idx
  ON support_messages(email_message_id)
  WHERE email_message_id IS NOT NULL;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS email_thread_id TEXT;
