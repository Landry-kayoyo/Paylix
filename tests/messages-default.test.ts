import { describe, expect, it } from 'vitest';
import { getDefaultActiveConversationId } from '@/lib/messages-utils';

describe('getDefaultActiveConversationId', () => {
  it('returns the first unread conversation when available', () => {
    const conversations = [
      { id: 'a', is_unread: false },
      { id: 'b', is_unread: true },
      { id: 'c', is_unread: false },
    ];

    expect(getDefaultActiveConversationId(conversations)).toBe('b');
  });

  it('falls back to the first conversation when none are unread', () => {
    const conversations = [
      { id: 'a', is_unread: false },
      { id: 'b', is_unread: false },
    ];

    expect(getDefaultActiveConversationId(conversations)).toBe('a');
  });

  it('returns null when there are no conversations', () => {
    expect(getDefaultActiveConversationId([])).toBeNull();
  });
});
