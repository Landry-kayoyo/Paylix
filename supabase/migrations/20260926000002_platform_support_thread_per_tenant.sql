-- Keep exactly one platform-support discussion for each tenant.
INSERT INTO public.message_categories (id, name, description)
VALUES ('platform_support', 'Support plateforme', 'Discussion entre Paylix et la direction de l’établissement.')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _platform_support_thread_map ON COMMIT DROP AS
SELECT
  conversation.id AS conversation_id,
  conversation.tenant_id,
  first_value(conversation.id) OVER (
    PARTITION BY conversation.tenant_id
    ORDER BY (conversation.category = 'platform_support') DESC, conversation.created_at, conversation.id
  ) AS canonical_id
FROM public.conversations AS conversation
WHERE conversation.tenant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships AS membership
    WHERE membership.user_id = conversation.created_by
      AND membership.role = 'platform_admin'
  );

-- Preserve participants from duplicate admin-created discussions before removing them.
INSERT INTO public.conversation_participants (
  conversation_id,
  user_id,
  joined_at,
  last_read_at,
  archived_at
)
SELECT
  mapping.canonical_id,
  participant.user_id,
  min(participant.joined_at),
  min(participant.last_read_at),
  CASE
    WHEN bool_or(participant.archived_at IS NULL) THEN NULL
    ELSE max(participant.archived_at)
  END
FROM _platform_support_thread_map AS mapping
JOIN public.conversation_participants AS participant
  ON participant.conversation_id = mapping.conversation_id
WHERE mapping.conversation_id <> mapping.canonical_id
GROUP BY mapping.canonical_id, participant.user_id
ON CONFLICT (conversation_id, user_id) DO NOTHING;

UPDATE public.messages AS message
SET conversation_id = mapping.canonical_id
FROM _platform_support_thread_map AS mapping
WHERE message.conversation_id = mapping.conversation_id
  AND mapping.conversation_id <> mapping.canonical_id;

UPDATE public.conversations AS canonical
SET category = 'platform_support',
    subject = NULL,
    updated_at = grouped.latest_update
FROM (
  SELECT mapping.canonical_id, max(source.updated_at) AS latest_update
  FROM _platform_support_thread_map AS mapping
  JOIN public.conversations AS source ON source.id = mapping.conversation_id
  GROUP BY mapping.canonical_id
) AS grouped
WHERE canonical.id = grouped.canonical_id;

DELETE FROM public.conversations AS duplicate
USING _platform_support_thread_map AS mapping
WHERE duplicate.id = mapping.conversation_id
  AND mapping.conversation_id <> mapping.canonical_id;

-- Every active platform admin and active director can participate in the shared tenant thread.
INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT DISTINCT support_thread.id, membership.user_id
FROM public.conversations AS support_thread
JOIN public.user_memberships AS membership
  ON membership.role = 'platform_admin'
 AND membership.status = 'active'
WHERE support_thread.category = 'platform_support'
UNION
SELECT DISTINCT support_thread.id, membership.user_id
FROM public.conversations AS support_thread
JOIN public.user_memberships AS membership
  ON membership.tenant_id = support_thread.tenant_id
 AND membership.role = 'director'
 AND membership.status = 'active'
WHERE support_thread.category = 'platform_support'
ON CONFLICT (conversation_id, user_id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_support_one_thread_per_tenant
  ON public.conversations (tenant_id)
  WHERE category = 'platform_support' AND tenant_id IS NOT NULL;