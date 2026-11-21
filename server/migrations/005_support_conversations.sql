CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'processing', 'waiting_user', 'resolved')),
  source TEXT NOT NULL DEFAULT 'app',
  email_thread_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'owner', 'system')),
  sender_name TEXT,
  sender_email TEXT,
  body TEXT NOT NULL,
  email_message_id TEXT,
  email_direction TEXT CHECK (email_direction IN ('outbound', 'inbound')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_status_updated_idx
  ON support_tickets(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_email_idx
  ON support_tickets(requester_email);
CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx
  ON support_messages(ticket_id, created_at);
