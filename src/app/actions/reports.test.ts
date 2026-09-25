import { describe, expect, it } from 'vitest';
import { pickFirstDirectorMembership } from './reports';

describe('pickFirstDirectorMembership', () => {
  it('chooses the first active director membership when multiple tenant memberships exist', async () => {
    const memberships = [
      { tenant_id: 'tenant-a', role: 'accountant', status: 'active' },
      { tenant_id: 'tenant-b', role: 'director', status: 'active' },
      { tenant_id: 'tenant-c', role: 'director', status: 'active' },
    ];

    expect(await pickFirstDirectorMembership(memberships)).toEqual({
      tenant_id: 'tenant-b',
      role: 'director',
      status: 'active',
    });
  });

  it('returns null when no active director membership exists', async () => {
    expect(await pickFirstDirectorMembership([
      { tenant_id: 'tenant-a', role: 'accountant', status: 'active' },
    ])).toBeNull();
  });
});
