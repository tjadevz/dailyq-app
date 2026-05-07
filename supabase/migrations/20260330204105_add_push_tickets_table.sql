
CREATE TABLE IF NOT EXISTS push_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  ticket_id text,
  status text NOT NULL DEFAULT 'pending', -- pending | ok | error
  error_type text, -- DeviceNotRegistered | MessageTooBig | etc
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_tickets_status_idx ON push_tickets(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS push_tickets_created_idx ON push_tickets(created_at);
;
