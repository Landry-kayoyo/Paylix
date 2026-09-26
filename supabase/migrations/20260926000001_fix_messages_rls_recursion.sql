-- Prevent recursive RLS evaluation when conversation policies inspect participants.
-- SECURITY DEFINER lets this narrow helper read the participant relation without
-- re-entering its own SELECT policy; the authenticated user is always taken from auth.uid().
CREATE OR REPLACE FUNCTION public.is_current_user_conversation_participant(
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants AS cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_conversation_participant(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_conversation_participant(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view conversations they are part of" ON public.conversations;
CREATE POLICY "Users can view conversations they are part of" ON public.conversations
FOR SELECT USING (
  public.is_current_user_conversation_participant(id)
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_memberships
      WHERE user_id = auth.uid()
        AND role = 'platform_admin'
        AND status = 'active'
    )
  )
);

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of their conversations" ON public.conversation_participants
FOR SELECT USING (
  public.is_current_user_conversation_participant(conversation_id)
);

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
FOR SELECT USING (
  public.is_current_user_conversation_participant(conversation_id)
);

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
CREATE POLICY "Users can insert messages in their conversations" ON public.messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND public.is_current_user_conversation_participant(conversation_id)
);