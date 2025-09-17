import React, { useMemo, useState, useEffect } from 'react';
import './Home.css';

export default function Home({ user, routes = [] }) {
  // Search & filter state
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  // Tick every minute so time-based stats (departures, greeting) stay fresh
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeTick(t => t + 1), 60000); // 1 min
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return routes.filter(r => {
      if (verifiedOnly && !r.verified) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (q && !(`${r.code} ${r.name}`.toLowerCase().includes(q))) return false;
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
  }, [routes, timeTick]); // depend on minute tick so departures update

  const greeting = getGreeting();

  const getFilterLabel = (type) => {
    switch (type) {
      case 'all': return 'All Routes';
      case 'semi': return 'Semi Luxury';
      case 'luxury': return 'Luxury AC';
      case 'normal': return 'Standard';
      default: return type;
    }
  };

  const badgeClass = (verified, neutral = false) => {
    if (neutral) return 'verification-badge--neutral';
    return verified ? 'verification-badge--verified' : 'verification-badge--unverified';
  };

  const getVerificationText = (verified) => (verified ? 'Verified Route' : 'Unverified');

  const formatStatValue = (value, type) => {
    if (type === 'departures' && value > 999) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  };

  return (
    <div className="home">
      <h2 className="home__greeting">Good {greeting}, {user?.name || 'Traveler'}</h2>
      <p className="home__sub">Find reliable bus routes and real-time transit information</p>

      <div className="home__searchbar">
        <input
          type="text"
          placeholder="Search routes, destinations, bus numbers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search bus routes"
        />
      </div>

      <div className="home__filters">
        {['all', 'luxury', 'semi', 'normal'].map(t => (
          <button
            key={t}
            className={'home__filter-btn' + (typeFilter === t ? ' active' : '')}
            onClick={() => setTypeFilter(t)}
            aria-pressed={typeFilter === t}
          >
            {getFilterLabel(t)}
          </button>
        ))}
      </div>

      <label className="home__toggle">
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={e => setVerifiedOnly(e.target.checked)}
          aria-describedby="verified-help"
        />
        <span>Show verified routes only</span>
        <span
          id="verified-help"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden'
          }}
        >When enabled, only routes verified by transit authorities are shown.</span>
      </label>

      <h3 className="home__section-title">Popular Transit Routes</h3>
      <ul className="home__popular-list">
        {popular.map(r => (
          <li key={r.id} className="home__popular-item">
            <span className="home__popular-code">Route {r.code}</span>
            <span>{r.name}</span>
            <span className={badgeClass(r.verified)}>
              {getVerificationText(r.verified)}
            </span>
          </li>
        ))}
        {popular.length === 0 && (
          <li className="home__popular-item">
            <span className="home__popular-code">No Routes</span>
            <span>No popular routes available at this time</span>
            <span className={badgeClass(false, true)}>Check back later</span>
          </li>
        )}
      </ul>

      <h3 className="home__section-title">Transit Statistics Today</h3>
      <div className="home__stats">
        <div className="home__stat-box">
          <p className="home__stat-label">Total Routes</p>
          <p className="home__stat-value">{formatStatValue(stats.total, 'total')}</p>
        </div>
        <div className="home__stat-box">
          <p className="home__stat-label">Verified Routes</p>
          <p className="home__stat-value">{formatStatValue(stats.verified, 'verified')}</p>
        </div>
        <div className="home__stat-box">
          <p className="home__stat-label">Daily Departures</p>
          <p className="home__stat-value">{formatStatValue(stats.departures, 'departures')}</p>
        </div>
      </div>

      <h3 className="home__section-title" style={{ marginTop: '3rem' }}>
        Search Results ({filtered.length} {filtered.length === 1 ? 'route' : 'routes'})
      </h3>
      <ul className="home__popular-list">
        {filtered.map(r => (
          <li key={r.id} className="home__popular-item">
            <span className="home__popular-code">Route {r.code}</span>
            <span>{r.name}</span>
            <span className={badgeClass(r.verified)}>
              {getVerificationText(r.verified)}
            </span>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="home__popular-item">
            <span className="home__popular-code">No Results</span>
            <span>No routes match your current search criteria</span>
            <span className={badgeClass(false, true)}>Try different filters</span>
          </li>
        )}
      </ul>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function estimateDepartures(routes) {
  const now = new Date();
  const start = new Date();
  start.setHours(5, 0, 0, 0);
  if (now < start) return 0;
  const minutes = Math.floor((now - start) / 60000);
  return routes.reduce((sum, r) => {
    const headway = r.headwayMins || 15;
    const routeDepartures = Math.max(0, Math.floor(minutes / headway));
    return sum + routeDepartures;
  }, 0);
}