import React, { useEffect, useMemo, useState } from 'react';
import './Browse.css';
import RoutesList from './RoutesList';
import NextBus from './NextBus';

const RECENT_KEY = 'browseRecentSearches';

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function saveRecent(list) { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0,8))); }

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

  return (
    <div className="browse">
      <div className="browse__search">
        <input
          placeholder="Search bus routes..."
          value={query}
          onChange={e=>setQuery(e.target.value)}
          onBlur={()=>commitSearch(query)}
          onKeyDown={e=>{ if (e.key==='Enter') { commitSearch(query); onSearch && onSearch(query); } }}
        />
      </div>
      {recent.length > 0 && (
        <div className="browse__recent">
          <span className="browse__recent-label">Recent Searches</span>
          {recent.map((r,i)=>(
            <span key={i} className="browse__recent-item" onClick={()=>{handleRecentClick(r); onSearch && onSearch(r);} }>{r}</span>
          ))}
        </div>
      )}

      <div className="browse__layout" style={{marginTop:'1rem'}}>
        <div className="browse__left">
          <h2 style={{marginTop:0}}>Routes ({filtered.length})</h2>
          <RoutesList routes={filtered} selected={selected} onSelect={onSelect} />
        </div>
        <div className="browse__right">
          <h2 style={{marginTop:0}}>Next Bus</h2>
          {selected ? <NextBus route={selected} apiBase={apiBase} /> : <p>Select a route.</p>}
        </div>
      </div>
    </div>
  );
}
