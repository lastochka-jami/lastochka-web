export type LocationMode = 'delivery' | 'pickup';
export interface LocationSelection {
  mode: LocationMode;
  label?: string;
  storeId?: number;
  addressId?: number;
}
export const LOCATION_OPEN_EVENT = 'lastochka:open-location';
export const LOCATION_CHANGED_EVENT = 'lastochka:location-changed';
export const LOCATION_MODE_STORAGE_KEY = 'lastochka:location-mode';
const SELECTION_KEY = 'lastochka:location-selection';

export function readLocation(): LocationSelection {
  try {
    const saved = JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null');
    const mode = localStorage.getItem(LOCATION_MODE_STORAGE_KEY) === 'pickup' ? 'pickup' : 'delivery';
    return saved?.mode === mode ? saved : { mode };
  } catch { return { mode: 'delivery' }; }
}

export function announceLocation(selection: LocationSelection): void {
  const previous = readLocation();
  const next = { ...(previous.mode === selection.mode ? previous : {}), ...selection };
  localStorage.setItem(LOCATION_MODE_STORAGE_KEY, next.mode);
  localStorage.setItem(SELECTION_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<LocationSelection>(LOCATION_CHANGED_EVENT, { detail: next }));
}
