export const SIDEBAR_COLLAPSED_STORAGE_KEY = "paylix-sidebar-collapsed";

export function getSidebarCollapsePreference(storage: Storage | null = globalThis.localStorage): boolean {
  if (!storage) {
    return false;
  }

  const rawValue = storage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  return rawValue === "true";
}

export function setSidebarCollapsePreference(value: boolean, storage: Storage | null = globalThis.localStorage): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${SIDEBAR_COLLAPSED_STORAGE_KEY}=${value}; path=/; max-age=31536000; SameSite=Lax`;
  }
  if (!storage) {
    return;
  }

  storage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
}
