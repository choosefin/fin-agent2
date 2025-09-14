-- Chat History Tables for persistent chat storage

-- Chat Sessions Table (main chat containers)
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  assistant_type TEXT NOT NULL DEFAULT 'general' CHECK (assistant_type IN ('general', 'analyst', 'trader', 'advisor', 'riskManager', 'economist')),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages Table (individual messages within chats)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  thread_id UUID, -- For grouping related messages into threads
  parent_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL, -- For message threading/replies
  metadata JSONB DEFAULT '{}', -- Store provider, model, tokens, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Metadata Table (aggregated stats and tags)
CREATE TABLE chat_metadata (
  chat_session_id UUID PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  total_messages INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  providers_used JSONB DEFAULT '[]', -- Array of provider names used
  tags TEXT[] DEFAULT '{}', -- User-defined tags for organization
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Shares Table (for sharing chats with others)
CREATE TABLE chat_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX idx_chat_sessions_last_message_at ON chat_sessions(last_message_at DESC);
CREATE INDEX idx_chat_sessions_archived ON chat_sessions(is_archived);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(chat_session_id);
CREATE INDEX idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX idx_chat_messages_parent_id ON chat_messages(parent_message_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX idx_chat_metadata_session_id ON chat_metadata(chat_session_id);
CREATE INDEX idx_chat_metadata_tags ON chat_metadata USING GIN(tags);

CREATE INDEX idx_chat_shares_token ON chat_shares(share_token);
CREATE INDEX idx_chat_shares_session_id ON chat_shares(chat_session_id);

-- Full text search index on message content
CREATE INDEX idx_chat_messages_content_fts ON chat_messages USING GIN(to_tsvector('english', content));

-- Function to auto-generate chat title from first message
CREATE OR REPLACE FUNCTION generate_chat_title()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate title if it's the first message and chat has no title
  IF NEW.role = 'user' AND NOT EXISTS (
    SELECT 1 FROM chat_messages 
    WHERE chat_session_id = NEW.chat_session_id 
    AND id != NEW.id
  ) THEN
    UPDATE chat_sessions 
    SET title = CASE 
      WHEN LENGTH(NEW.content) > 100 
      THEN SUBSTRING(NEW.content, 1, 97) || '...'
      ELSE NEW.content
    END
    WHERE id = NEW.chat_session_id 
    AND title IS NULL;
  END IF;
  
  -- Update last message timestamp
  UPDATE chat_sessions 
  SET last_message_at = NEW.created_at 
  WHERE id = NEW.chat_session_id;
  
  -- Update metadata
  UPDATE chat_metadata 
  SET 
    total_messages = total_messages + 1,
    last_activity = NEW.created_at
  WHERE chat_session_id = NEW.chat_session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate title and update metadata
CREATE TRIGGER auto_generate_chat_title
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION generate_chat_title();

-- Function to initialize chat metadata
CREATE OR REPLACE FUNCTION init_chat_metadata()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO chat_metadata (chat_session_id)
  VALUES (NEW.id)
  ON CONFLICT (chat_session_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create metadata entry when chat session is created
CREATE TRIGGER init_chat_metadata_trigger
AFTER INSERT ON chat_sessions
FOR EACH ROW EXECUTE FUNCTION init_chat_metadata();

-- Update triggers for updated_at columns
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_metadata_updated_at BEFORE UPDATE ON chat_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_shares ENABLE ROW LEVEL SECURITY;

-- Chat sessions policies
CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
  ON chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Users can view messages from their chats"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their chats"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in their chats"
  ON chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from their chats"
  ON chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Chat metadata policies
CREATE POLICY "Users can view metadata for their chats"
  ON chat_metadata FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_metadata.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update metadata for their chats"
  ON chat_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_metadata.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Chat shares policies
CREATE POLICY "Users can view shares for their chats"
  ON chat_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_shares.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    ) OR
    -- Allow viewing by share token (public access)
    share_token IS NOT NULL
  );

CREATE POLICY "Users can create shares for their chats"
  ON chat_shares FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by AND
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_shares.chat_session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own shares"
  ON chat_shares FOR DELETE
  USING (auth.uid() = shared_by);