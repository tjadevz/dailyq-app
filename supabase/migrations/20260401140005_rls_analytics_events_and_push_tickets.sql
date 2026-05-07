
-- analytics_events: RLS aan, users mogen alleen eigen rows inserten, nooit lezen
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own analytics events"
ON analytics_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- push_tickets: RLS aan, geen user policies (alleen service role via Edge Function)
ALTER TABLE push_tickets ENABLE ROW LEVEL SECURITY;
;
