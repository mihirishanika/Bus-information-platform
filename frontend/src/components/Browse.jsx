import React, { useEffect, useMemo, useState } from 'react';
import './Browse.css';
import RoutesList from './RoutesList';

const RECENT_KEY = 'browseRecentSearches';

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function saveRecent(list) { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); }

export default function Browse({ routes, selected, onSelect, apiBase, onSearch }) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(loadRecent());

  useEffect(() => { saveRecent(recent); }, [recent]);

  const filtered = useMemo(() => {
    if (!query) return routes;
    const q = query.toLowerCase();
    return routes.filter(r => `${r.code} ${r.name}`.toLowerCase().includes(q));
  }, [routes, query]);

  const commitSearch = (value) => {
    if (!value.trim()) return;
    setRecent(r => [value.trim(), ...r.filter(v => v !== value.trim())]);
  };

  const handleRecentClick = (term) => {
    setQuery(term);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      commitSearch(query.trim());
      if (onSearch) onSearch(query.trim());
    }
  };

  return (
    <div className="browse">
      <h2 className="browse__greeting">Browse Routes</h2>
      <p className="browse__sub">Find and explore bus routes across Sri Lanka</p>

      <form className="browse__searchbar" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Search routes, destinations, bus numbers..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search bus routes"
        />
      </form>

      {recent.length > 0 && (
        <div className="browse__recent">
          <span className="browse__recent-label">Recent Searches</span>
          {recent.map((r, i) => (
            <span
              key={i}
              className={"browse__recent-item" + (query === r ? ' active' : '')}
              onClick={() => { handleRecentClick(r); onSearch && onSearch(r); }}
            >{r}</span>
          ))}
        </div>
      )}

      <div className="browse__routes-section">
        <h3 className="browse__section-title">Available Routes ({filtered.length})</h3>
        <div className="browse__routes-container">
          <RoutesList routes={filtered} selected={selected} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}
