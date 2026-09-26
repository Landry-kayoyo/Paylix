-- Phase 18: Messages & Chat interne Paylix

-- 1. Table message_categories
CREATE TABLE IF NOT EXISTS message_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

INSERT INTO message_categories (id, name) VALUES
('general', 'Information générale'),
('schooling', 'Scolarité'),
('administration', 'Administration'),
('reminder', 'Rappel'),
('financial', 'Situation financière'),
('event', 'Événement'),
('other', 'Autre')
ON CONFLICT DO NOTHING;

-- 2. Table conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    subject TEXT,
    category TEXT REFERENCES message_categories(id),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);

-- 3. Table conversation_participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    UNIQUE(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);

-- 4. Table messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- denormalized for RLS
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    is_system_message BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 5. Table message_campaigns (for broadcasts)
CREATE TABLE IF NOT EXISTS message_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT REFERENCES message_categories(id),
    targeting_criteria JSONB,
    recipient_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_tenant ON message_campaigns(tenant_id);

-- 6. RLS Policies

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_campaigns ENABLE ROW LEVEL SECURITY;

-- Conversations: A user can see a conversation if they are a participant
CREATE POLICY "Users can view conversations they are part of" ON conversations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = conversations.id AND user_id = auth.uid()
    )
    OR
    ( -- Platform admins can view conversations sent by them
      created_by = auth.uid() AND EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND role = 'platform_admin' AND status = 'active')
    )
);

CREATE POLICY "Users can create conversations in their tenant" ON conversations
FOR INSERT WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND status = 'active'
    )
    OR tenant_id IS NULL -- Platform admin conversations might not have a tenant
);

-- Conversation Participants: Users can see participants of their conversations
CREATE POLICY "Users can view participants of their conversations" ON conversation_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp 
        WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert participants" ON conversation_participants
FOR INSERT WITH CHECK (
    -- Validation logic for allowed participants will primarily be handled by RPCs or service logic to avoid complex RLS
    true
);

CREATE POLICY "Users can update their own participant record (archive/read)" ON conversation_participants
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Messages
CREATE POLICY "Users can view messages in their conversations" ON messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert messages in their conversations" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own messages" ON messages
FOR UPDATE USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- Message Campaigns (Broadcasts)
CREATE POLICY "Directors can view campaigns in their tenant" ON message_campaigns
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND role = 'director' AND status = 'active'
    )
    OR
    (tenant_id IS NULL AND EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND role = 'platform_admin' AND status = 'active'))
);

CREATE POLICY "Directors can create campaigns in their tenant" ON message_campaigns
FOR INSERT WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND role = 'director' AND status = 'active'
    )
    OR
    (tenant_id IS NULL AND EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND role = 'platform_admin' AND status = 'active'))
);
