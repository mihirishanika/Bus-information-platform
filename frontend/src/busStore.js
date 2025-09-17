// Local bus info storage (demo). In real app this would call backend APIs.
// Shape: { id, busNumber, companyName, from, to, dailyDepartures, journeyDuration, adultFare, verifiedVotes, createdAt }

const KEY = 'appBusEntries';

export function loadBuses() {
  try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { return seed(); }
}

function seed() {
  const sample = [
    { id:'seed1', busNumber:'NC-1234', companyName:'SuperLine', from:'Colombo', to:'Kandy', dailyDepartures:6, journeyDuration:'3h 15m', adultFare:1200, verifiedVotes:4, createdAt: Date.now()-86400000 },
    { id:'seed2', busNumber:'NA-8899', companyName:'Eagle Travels', from:'Kandy', to:'Galle', dailyDepartures:2, journeyDuration:'5h 10m', adultFare:1800, verifiedVotes:2, createdAt: Date.now()-5600000 }
  ];
  localStorage.setItem(KEY, JSON.stringify(sample));
  return sample;
}

export function saveBuses(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addBus(entry) {
  const list = loadBuses();
  const withId = { id: crypto.randomUUID(), verifiedVotes: 0, createdAt: Date.now(), ...entry };
  list.push(withId);
  saveBuses(list);
  return withId;
}

export function searchBuses(query) {
  const q = query.toLowerCase();
  return loadBuses().filter(b => (
    b.busNumber.toLowerCase().includes(q) ||
    b.companyName.toLowerCase().includes(q) ||
    `${b.from} ${b.to}`.toLowerCase().includes(q)
  ));
}

export function upvoteVerification(id) {
  const list = loadBuses();
  const idx = list.findIndex(b => b.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], verifiedVotes: (list[idx].verifiedVotes||0) + 1 };
    saveBuses(list);
    return list[idx];
  }
  return null;
}
