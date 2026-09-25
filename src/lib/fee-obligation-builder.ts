export type FeeObligationRowInput = {
  tenantId: string;
  schoolYearId: string;
  feeId: string;
  feeType: 'unique' | 'monthly';
  currency: 'CDF' | 'USD';
  classIds: string[];
  defaultAmount: number;
  schedules: Array<{ id?: string; month: number; amount: number; due_date: string | null }>
  enrollments: Array<{ id: string; student_id: string; class_id: string }>;
};

export function buildFeeObligationRows(input: FeeObligationRowInput) {
  const { tenantId, schoolYearId, feeId, feeType, currency, classIds, defaultAmount, schedules, enrollments } = input;

  const classSet = new Set(classIds);
  const matchingEnrollments = enrollments.filter((enrollment) => classSet.has(enrollment.class_id));

  if (!matchingEnrollments.length) {
    return [];
  }

  if (feeType === 'monthly') {
    return matchingEnrollments.flatMap((enrollment) =>
      schedules.map((schedule) => ({
        tenant_id: tenantId,
        school_year_id: schoolYearId,
        student_id: enrollment.student_id,
        fee_id: feeId,
        fee_schedule_id: schedule.id || null,
        enrollment_id: enrollment.id,
        initial_amount: Number(schedule.amount || 0),
        paid_amount: 0,
        remaining_amount: Number(schedule.amount || 0),
        currency,
        due_date: schedule.due_date,
        status: 'unpaid',
      }))
    );
  }

  return matchingEnrollments.map((enrollment) => ({
    tenant_id: tenantId,
    school_year_id: schoolYearId,
    student_id: enrollment.student_id,
    fee_id: feeId,
    fee_schedule_id: null,
    enrollment_id: enrollment.id,
    initial_amount: Number(defaultAmount || 0),
    paid_amount: 0,
    remaining_amount: Number(defaultAmount || 0),
    currency,
    due_date: null,
    status: 'unpaid',
  }));
}
