import { describe, expect, it } from "vitest";
import { isPwaInstallDismissed, shouldShowInstallBanner, setPwaInstallDismissed } from "./install-banner";

function createStorageMock(initialValue: string | null = null) {
  const store = new Map<string, string>();

  if (initialValue !== null) {
    store.set("pwa_install_dismissed", initialValue);
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

describe("PWA install banner state", () => {
  it("does not show the banner when the user has already dismissed it", () => {
    const storage = createStorageMock("true");

    expect(isPwaInstallDismissed(storage)).toBe(true);
    expect(shouldShowInstallBanner(storage)).toBe(false);
  });

  it("marks the dismissal in storage without throwing when the browser storage is unavailable", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage unavailable");
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as unknown as Storage;

    expect(() => setPwaInstallDismissed(storage, true)).not.toThrow();
  });
});
