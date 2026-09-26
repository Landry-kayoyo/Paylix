export type MessageConversationLike = {
  id: string;
  is_unread?: boolean;
};

export function getDefaultActiveConversationId<T extends MessageConversationLike>(
  conversations: T[] | null | undefined,
): string | null {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return null;
  }

  const unreadConversation = conversations.find((conversation) => conversation.is_unread);
  return (unreadConversation ?? conversations[0])?.id ?? null;
}
