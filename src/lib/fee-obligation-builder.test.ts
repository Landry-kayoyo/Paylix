import { describe, expect, it } from 'vitest';
import { buildFeeObligationRows } from './fee-obligation-builder';

describe('buildFeeObligationRows', () => {
  it('creates one row per active enrollment for a unique fee', () => {
    const rows = buildFeeObligationRows({
      tenantId: 'tenant-1',
      schoolYearId: 'year-1',
      feeId: 'fee-1',
      feeType: 'unique',
      currency: 'CDF',
      classIds: ['class-1', 'class-2'],
      defaultAmount: 5000,
      schedules: [],
      enrollments: [
        { id: 'enr-1', student_id: 'stu-1', class_id: 'class-1' },
        { id: 'enr-2', student_id: 'stu-2', class_id: 'class-2' },
        { id: 'enr-3', student_id: 'stu-3', class_id: 'class-3' },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ student_id: 'stu-1', initial_amount: 5000, remaining_amount: 5000, fee_schedule_id: null });
  });

  it('creates one row per month schedule for a monthly fee', () => {
    const rows = buildFeeObligationRows({
      tenantId: 'tenant-1',
      schoolYearId: 'year-1',
      feeId: 'fee-2',
      feeType: 'monthly',
      currency: 'USD',
      classIds: ['class-1'],
      defaultAmount: 0,
      schedules: [
        { id: 'sched-1', month: 1, amount: 10, due_date: '2026-01-10' },
        { id: 'sched-2', month: 2, amount: 20, due_date: '2026-02-10' },
      ],
      enrollments: [
        { id: 'enr-1', student_id: 'stu-1', class_id: 'class-1' },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.fee_schedule_id)).toEqual(['sched-1', 'sched-2']);
  });
});
