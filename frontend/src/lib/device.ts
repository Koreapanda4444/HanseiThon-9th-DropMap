const DEVICE_ID_KEY = "beoril-map-device-id";

export function getOrCreateDeviceId() {
  const stored = window.localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const created = window.crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}
