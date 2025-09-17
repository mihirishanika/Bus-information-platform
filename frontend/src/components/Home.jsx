import React, { useMemo, useState } from 'react';
import './Home.css';

export default function Home({ user, routes }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filtered = useMemo(() => {
    return routes.filter(r => {
      if (verifiedOnly && !r.verified) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (query && !(`${r.code} ${r.name}`.toLowerCase().includes(query.toLowerCase()))) return false;
      return true;
    });
  }, [routes, query, typeFilter, verifiedOnly]);

  const popular = useMemo(() => routes.filter(r => r.popular).slice(0, 6), [routes]);

  // Simple stats: total routes, verified routes, estimated departures so far today
  const stats = useMemo(() => {
    const total = routes.length;
    const verified = routes.filter(r => r.verified).length;
    const departures = estimateDepartures(routes);
    return { total, verified, departures };
  }, [routes]);

  const greeting = getGreeting();

  return (
    <div className="home">
      <h2 className="home__greeting">Good {greeting}, {user?.name || 'User'}</h2>
      <p className="home__sub">Find your bus information</p>

      <div className="home__searchbar">
        <input
          type="text"
          placeholder="Search buses..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="home__filters">
        {['all','luxury','semi','normal'].map(t => (
          <button
            key={t}
            className={"home__filter-btn" + (typeFilter === t ? ' active' : '')}
            onClick={() => setTypeFilter(t)}
          >{t === 'all' ? 'All buses' : (t === 'semi' ? 'Semi luxury' : (t === 'luxury' ? 'Luxury/AC' : 'Normal'))}</button>
        ))}
      </div>

      <label className="home__toggle">
        <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} />
        Show verified only
      </label>

      <h3 className="home__section-title">Popular Routes</h3>
      <ul className="home__popular-list">
        {popular.map(r => (
          <li key={r.id} className="home__popular-item">
            <span className="home__popular-code">{r.code}</span>
            <span>{r.name}</span>
            <span style={{color: r.verified ? '#16a34a' : '#b91c1c'}}>{r.verified ? 'Verified' : 'Unverified'}</span>
          </li>
        ))}
        {popular.length === 0 && <li>No popular routes</li>}
      </ul>

      <h3 className="home__section-title">Today's Stats</h3>
      <div className="home__stats">
        <div className="home__stat-box">
          <p className="home__stat-label">Total Routes</p>
          <p className="home__stat-value">{stats.total}</p>
        </div>
        <div className="home__stat-box">
          <p className="home__stat-label">Verified</p>
          <p className="home__stat-value">{stats.verified}</p>
        </div>
        <div className="home__stat-box">
          <p className="home__stat-label">Departures (est)</p>
          <p className="home__stat-value">{stats.departures}</p>
        </div>
      </div>

      <h3 className="home__section-title" style={{marginTop:'1.25rem'}}>Filtered Results ({filtered.length})</h3>
      <ul className="home__popular-list">
        {filtered.map(r => (
          <li key={r.id} className="home__popular-item">
            <span className="home__popular-code">{r.code}</span>
            <span>{r.name}</span>
            <span style={{color: r.verified ? '#16a34a' : '#b91c1c'}}>{r.verified ? 'Verified' : 'Unverified'}</span>
          </li>
        ))}
        {filtered.length === 0 && <li>No matches</li>}
      </ul>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function estimateDepartures(routes) {
  // From 05:00 to now in minutes / headway
  const now = new Date();
  const start = new Date();
  start.setHours(5,0,0,0);
  let minutes = Math.max(0, Math.floor((now - start) / 60000));
  return routes.reduce((sum, r) => sum + Math.max(0, Math.floor(minutes / (r.headwayMins || 15))), 0);
}
