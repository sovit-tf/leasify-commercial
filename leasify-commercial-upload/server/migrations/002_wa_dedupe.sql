-- WhatsApp: look up a message by its Meta id quickly (de-duplication of webhook retries)
CREATE INDEX IF NOT EXISTS wa_events_msgid_idx ON wa_events ((raw->>'id'));
