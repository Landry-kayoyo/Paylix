import { describe, expect, it } from 'vitest';
import { getDefaultDashboardPath } from './user-profile';

describe('getDefaultDashboardPath', () => {
  it('routes platform admins to /platform', () => {
    expect(getDefaultDashboardPath([{ role: 'platform_admin' }])).toBe('/platform');
  });

  it('routes directors to /school', () => {
    expect(getDefaultDashboardPath([{ role: 'director' }])).toBe('/school');
  });

  it('routes accountants to /accountant', () => {
    expect(getDefaultDashboardPath([{ role: 'accountant' }])).toBe('/accountant');
  });

  it('routes parents to /parent', () => {
    expect(getDefaultDashboardPath([{ role: 'parent' }])).toBe('/parent');
  });

  it('falls back to landing for unknown or empty memberships', () => {
    expect(getDefaultDashboardPath([])).toBe('/');
    expect(getDefaultDashboardPath(null)).toBe('/');
  });
});
