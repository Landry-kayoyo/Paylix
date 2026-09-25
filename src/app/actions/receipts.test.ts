import { describe, expect, it } from 'vitest';
import { formatFeeDisplayName, formatPeriodMonthLabel } from '../../lib/month-label';

describe('formatPeriodMonthLabel', () => {
  it('returns the French month name for a numeric month', () => {
    expect(formatPeriodMonthLabel(1)).toBe('Janvier');
    expect(formatPeriodMonthLabel(5)).toBe('Mai');
    expect(formatPeriodMonthLabel(12)).toBe('Décembre');
  });

  it('returns an empty string for a null month (general fee)', () => {
    expect(formatPeriodMonthLabel(null)).toBe('');
  });
});

describe('formatFeeDisplayName', () => {
  it('includes the month in the fee name when a period exists', () => {
    expect(formatFeeDisplayName('Minerval', 4)).toBe('Minerval Avril');
    expect(formatFeeDisplayName('Frais scolaire', 8)).toBe('Frais scolaire Août');
  });

  it('keeps the base fee name when no period exists', () => {
    expect(formatFeeDisplayName('Minerval', null)).toBe('Minerval');
    expect(formatFeeDisplayName('Frais scolaire', undefined)).toBe('Frais scolaire');
  });
});
