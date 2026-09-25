import { describe, expect, it } from "vitest";
import { getPaginationMeta } from "./pagination";

describe("getPaginationMeta", () => {
  it("calculates a page summary for a paged list", () => {
    const meta = getPaginationMeta({ page: 2, pageSize: 10, total: 42 });

    expect(meta.totalPages).toBe(5);
    expect(meta.hasPrevious).toBe(true);
    expect(meta.hasNext).toBe(true);
    expect(meta.startIndex).toBe(11); // (2-1)*10 + 1 = 11 (1-based)
    expect(meta.endIndex).toBe(20);
  });

  it("returns empty pagination when nothing exists", () => {
    const meta = getPaginationMeta({ page: 1, pageSize: 10, total: 0 });

    expect(meta.totalPages).toBe(0);
    expect(meta.hasPrevious).toBe(false);
    expect(meta.hasNext).toBe(false);
    expect(meta.startIndex).toBe(0);
    expect(meta.endIndex).toBe(0);
  });
});
