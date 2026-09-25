"use client";

const STORAGE_KEY = "pwa_install_dismissed";

export function isPwaInstallDismissed(storage: Storage = window.localStorage) {
  try {
    return storage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPwaInstallDismissed(storage: Storage = window.localStorage, value = true) {
  try {
    if (value) {
      storage.setItem(STORAGE_KEY, "true");
    } else {
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted/private browsing environments.
  }
}

export function shouldShowInstallBanner(storage: Storage = window.localStorage) {
  if (typeof window === "undefined") return false;
  return !isPwaInstallDismissed(storage);
}

export function InstallBanner() {
  if (typeof window === "undefined") return null;

  const showBanner = shouldShowInstallBanner();
  if (!showBanner) return null;

  return null;
}
