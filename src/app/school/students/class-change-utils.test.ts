import { describe, it, expect } from "vitest";
import { buildEnrollmentChangeHistoryRecord } from "./class-change-utils";

describe("buildEnrollmentChangeHistoryRecord", () => {
  it("builds a stable row payload for enrollment class history", () => {
    const payload = buildEnrollmentChangeHistoryRecord({
      tenant_id: "tenant-123",
      enrollment_id: "enrollment-456",
      old_class_id: "old-class-789",
      new_class_id: "new-class-101",
      changed_by: "user-202",
    });

    expect(payload).toEqual({
      tenant_id: "tenant-123",
      enrollment_id: "enrollment-456",
      old_class_id: "old-class-789",
      new_class_id: "new-class-101",
      changed_by: "user-202",
    });
  });
});
