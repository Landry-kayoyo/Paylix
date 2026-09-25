import { describe, expect, it, vi } from "vitest";
import { SIDEBAR_COLLAPSED_STORAGE_KEY, getSidebarCollapsePreference, setSidebarCollapsePreference } from "./sidebar-state";

function createStorageMock(initialValue: string | null = null) {
  const store = new Map<string, string>();

  if (initialValue !== null) {
    store.set(SIDEBAR_COLLAPSED_STORAGE_KEY, initialValue);
  }

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    length: store.size,
  } as Storage;
}

describe("sidebar state persistence", () => {
  it("reads the persisted collapsed state from localStorage", () => {
    const storage = createStorageMock("true");

    expect(getSidebarCollapsePreference(storage)).toBe(true);
  });

  it("stores the collapsed value when the user toggles the sidebar", () => {
    const storage = createStorageMock();
    const setItemSpy = vi.spyOn(storage, "setItem");

    setSidebarCollapsePreference(true, storage);

    expect(setItemSpy).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, "true");
  });
});
