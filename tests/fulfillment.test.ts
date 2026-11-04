import test from 'node:test';
import assert from 'node:assert/strict';
import { announceLocation, readLocation, LOCATION_CHANGED_EVENT, LOCATION_MODE_STORAGE_KEY, type LocationSelection } from '../src/lib/fulfillment';

const memory = new Map<string, string>();
const events = new EventTarget();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  },
  window: { dispatchEvent: (event: Event) => events.dispatchEvent(event) },
});

test('fulfillment persists mode, real store label and address together and announces the same selection', () => {
  memory.clear();
  const selections: LocationSelection[] = [];
  events.addEventListener(LOCATION_CHANGED_EVENT, event => selections.push((event as CustomEvent<LocationSelection>).detail));
  const pickup: LocationSelection = { mode: 'pickup', storeId: 3, label: 'ул. Ленина, 20' };
  announceLocation(pickup);
  assert.deepEqual(readLocation(), pickup);
  assert.deepEqual(selections.at(-1), pickup);
  assert.equal(memory.get(LOCATION_MODE_STORAGE_KEY), 'pickup');
  const delivery: LocationSelection = { mode: 'delivery', addressId: 41, storeId: 7, label: 'ул. Мира, 4' };
  announceLocation(delivery);
  assert.deepEqual(readLocation(), delivery);
  assert.deepEqual(selections.at(-1), delivery);
  announceLocation({ mode: 'pickup' });
  assert.deepEqual(readLocation(), { mode: 'pickup' });
  assert.equal(readLocation().addressId, undefined);
  memory.set('lastochka:location-selection', '{bad json');
  assert.deepEqual(readLocation(), { mode: 'delivery' });
});
