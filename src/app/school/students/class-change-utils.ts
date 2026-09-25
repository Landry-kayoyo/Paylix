export type EnrollmentChangeHistoryInput = {
  tenant_id: string;
  enrollment_id: string;
  old_class_id: string;
  new_class_id: string;
  changed_by?: string | null;
};

export function buildEnrollmentChangeHistoryRecord(input: EnrollmentChangeHistoryInput) {
  return {
    tenant_id: input.tenant_id,
    enrollment_id: input.enrollment_id,
    old_class_id: input.old_class_id,
    new_class_id: input.new_class_id,
    changed_by: input.changed_by,
  };
}
