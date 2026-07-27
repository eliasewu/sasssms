-- Add assigned_to column for live chat transfer
ALTER TABLE live_chat_rooms ADD COLUMN assigned_to integer;

-- Create live_chat_notes table for internal admin notes
CREATE TABLE IF NOT EXISTS live_chat_notes (
  id serial PRIMARY KEY,
  room_id integer NOT NULL REFERENCES live_chat_rooms(id) ON DELETE CASCADE,
  admin_id integer NOT NULL,
  admin_name varchar(255) NOT NULL,
  note text NOT NULL,
  created_at timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_live_chat_notes_room_id ON live_chat_notes(room_id);
CREATE INDEX idx_live_chat_notes_created_at ON live_chat_notes(created_at);
