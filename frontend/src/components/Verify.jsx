import React, { useEffect, useState } from 'react';
import './Verify.css';

/* Demo pending verification list stored in localStorage for persistence across refresh.
   Each pending item shape: { id, busNumber, submitter, submittedAt, status }
*/
const STORAGE_KEY = 'pendingBusVerifications';

function loadPending() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function savePending(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Seed with a few demo entries if empty
function ensureSeed() {
  const current = loadPending();
  if (current.length === 0) {
    const seed = [
      { id: 'PB-001', busNumber: 'NC-1234', submitter: 'demo@user.com', submittedAt: Date.now() - 3600_000, status: 'pending' },
      { id: 'PB-002', busNumber: 'NA-8899', submitter: 'ops@fleet.com', submittedAt: Date.now() - 8600_000, status: 'pending' },
      { id: 'PB-003', busNumber: 'WP-4455', submitter: 'owner@buses.lk', submittedAt: Date.now() - 200_000, status: 'pending' }
    ];
    savePending(seed);
    return seed;
  }
  return current;
}

export default function Verify({ onVerified }) {
  const [items, setItems] = useState(() => ensureSeed());
  const [filter, setFilter] = useState('pending');

  useEffect(() => { savePending(items); }, [items]);

  const markVerified = (id) => {
    setItems(list => list.map(i => i.id === id ? { ...i, status: 'verified', verifiedAt: Date.now() } : i));
    onVerified && onVerified(id);
  };

  const visible = items.filter(i => filter === 'all' ? true : i.status === filter);

  return (
    <div className="verify page-wrapper">
      <h2 className="verify__title">Pending Verification</h2>
      <div className="verify__pending-box">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', justifyContent: 'flex-start' }}>
          {['pending', 'verified', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="verify__btn" style={filter === f ? { background: '#1d4ed8' } : {}}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <p className="verify__section-label">Items</p>
        <ul className="verify__list">
          {visible.map(item => (
            <li key={item.id} className="verify__item">
              <div className="verify__bus">Bus Number: {item.busNumber}</div>
              <div className="verify__meta">
                <span>Submitted by {item.submitter}</span>
                <span>{new Date(item.submittedAt).toLocaleString()}</span>
                <span>Status: {item.status}</span>
                {item.verifiedAt && <span>Verified: {new Date(item.verifiedAt).toLocaleString()}</span>}
              </div>
              {item.status === 'pending' && (
                <div className="verify__btn-row">
                  <button className="verify__btn" onClick={() => markVerified(item.id)}>Verify</button>
                </div>
              )}
            </li>
          ))}
          {visible.length === 0 && <li className="verify__empty">No items for this filter.</li>}
        </ul>
      </div>
    </div>
  );
}
