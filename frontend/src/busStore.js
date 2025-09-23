// Legacy bus info storage (demo) - Now serves as migration helper and fallback
// New implementation primarily uses API calls to DynamoDB via api.js

import { searchBuses as apiSearchBuses, voteBusVerification } from './api';

const KEY = 'appBusEntries';

export function loadBuses() {
  try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { return seed(); }
}

function seed() {
  const sample = [
    {
      id: 'seed1',
      busNumber: 'NC-1234',
      companyName: 'SuperLine',
      from: 'Colombo',
      to: 'Kandy',
      dailyDepartures: 6,
      journeyDuration: '3h 15m',
      adultFare: 1200,
      verifiedVotes: 4,
      createdAt: Date.now() - 86400000,
      busType: 'semi',
      seatCount: 45,
      year: 2020
    },
    {
      id: 'seed2',
      busNumber: 'NA-8899',
      companyName: 'Eagle Travels',
      from: 'Kandy',
      to: 'Galle',
      dailyDepartures: 2,
      journeyDuration: '5h 10m',
      adultFare: 1800,
      verifiedVotes: 2,
      createdAt: Date.now() - 5600000,
      busType: 'luxury',
      seatCount: 35,
      year: 2019
    }
  ];
  localStorage.setItem(KEY, JSON.stringify(sample));
  return sample;
}

export function saveBuses(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addBus(entry) {
  // For backward compatibility - but recommend using API
  console.warn('addBus: Consider using createBus from api.js instead');
  const list = loadBuses();
  const withId = { id: crypto.randomUUID(), verifiedVotes: 0, createdAt: Date.now(), ...entry };
  list.push(withId);
  saveBuses(list);
  return withId;
}

// Updated to prefer API, fallback to localStorage
export async function searchBuses(query) {
  try {
    // Try API first
    const response = await apiSearchBuses(query);
    return response.buses || [];
  } catch (error) {
    console.warn('API search failed, falling back to localStorage:', error);

    // Fallback to local storage
    const q = query.toLowerCase();
    return loadBuses().filter(b => (
      (b.busNumber || '').toLowerCase().includes(q) ||
      (b.companyName || '').toLowerCase().includes(q) ||
      `${b.from || ''} ${b.to || ''}`.toLowerCase().includes(q)
    ));
  }
}

// Updated to use API
export async function upvoteVerification(id) {
  try {
    // Try API first - find bus by ID and vote by license number
    const buses = loadBuses();
    const bus = buses.find(b => b.id === id);

    if (bus && (bus.licenseNo || bus.busNumber)) {
      await voteBusVerification(bus.licenseNo || bus.busNumber);

      // Update local storage as well for immediate feedback
      const list = loadBuses();
      const idx = list.findIndex(b => b.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], verifiedVotes: (list[idx].verifiedVotes || 0) + 1 };
        saveBuses(list);
        return list[idx];
      }
    }
  } catch (error) {
    console.warn('API vote failed, falling back to localStorage:', error);

    // Fallback to local storage only
    const list = loadBuses();
    const idx = list.findIndex(b => b.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], verifiedVotes: (list[idx].verifiedVotes || 0) + 1 };
      saveBuses(list);
      return list[idx];
    }
  }
  return null;
}

// Migration helper: move localStorage data to API
export async function migrateToAPI() {
  const localBuses = loadBuses();
  const migrated = [];
  const errors = [];

  for (const bus of localBuses) {
    try {
      // Skip if it looks like seed data
      if (bus.id && bus.id.startsWith('seed')) continue;

      // Create via API
      const response = await fetch('/api/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bus)
      });

      if (response.ok) {
        migrated.push(bus);
      } else {
        errors.push({ bus: bus.id, error: await response.text() });
      }
    } catch (error) {
      errors.push({ bus: bus.id, error: error.message });
    }
  }

  return { migrated, errors };
}