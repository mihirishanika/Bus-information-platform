import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import './Home.css';
import { searchBuses, searchDirectionalBuses } from '../api';

export default function Home({ user, routes = [], onSearch }) {
  // Search & filter state
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Directional search state
  const [searchMode, setSearchMode] = useState('general'); // 'general' or 'directional'
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');

  // Autocomplete & recent searches
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const suggestionsRef = useRef(null);
  const [searchCounts, setSearchCounts] = useState({}); // query -> count

  // Tick every minute so time-based stats (departures, greeting) stay fresh
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeTick(t => t + 1), 60000); // 1 min
    return () => clearInterval(id);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('recentBusSearches') || '[]');
      if (Array.isArray(saved)) setRecentSearches(saved);
    } catch { }
  }, []);

  // Load search counts from localStorage
  useEffect(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('busSearchCounts') || '{}');
      if (counts && typeof counts === 'object') setSearchCounts(counts);
    } catch { }
  }, []);

  // Perform search when query or filters change
  useEffect(() => {
    if (searchMode === 'general' && query.trim()) {
      performSearch();
    } else if (searchMode === 'directional' && fromLocation.trim() && toLocation.trim()) {
      performDirectionalSearch();
    } else {
      setSearchResults([]);
      setSearchError(null);
    }
  }, [query, typeFilter, verifiedOnly, searchMode, fromLocation, toLocation]);

  const performSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);

    try {
      const filters = {
        type: typeFilter === 'all' ? undefined : typeFilter,
        verified: verifiedOnly || undefined
      };

      const response = await searchBuses(query.trim(), filters);
      setSearchResults(response.buses || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const performDirectionalSearch = async () => {
    if (!fromLocation.trim() || !toLocation.trim()) return;

    setSearching(true);
    setSearchError(null);

    try {
      const filters = {
        type: typeFilter === 'all' ? undefined : typeFilter,
        verified: verifiedOnly || undefined
      };

      const response = await searchDirectionalBuses(fromLocation.trim(), toLocation.trim(), filters);
      setSearchResults(response.buses || []);
    } catch (error) {
      console.error('Directional search error:', error);
      setSearchError(error.message || 'Directional search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const popular = useMemo(() => {
    // Use search results if available, otherwise fallback to routes
    const sourceRoutes = searchResults.length > 0 ? searchResults : routes;
    return sourceRoutes.filter(r => r.verified || (r.verifiedVotes && r.verifiedVotes >= 3)).slice(0, 6);
  }, [routes, searchResults]);

  // Simple stats: total routes, verified routes, estimated departures
  const stats = useMemo(() => {
    const sourceRoutes = searchResults.length > 0 ? searchResults : routes;
    const total = sourceRoutes.length;
    const verified = sourceRoutes.filter(r => r.verified || (r.verifiedVotes && r.verifiedVotes >= 3)).length;
    const departures = estimateDepartures(sourceRoutes);
    return { total, verified, departures };
  }, [routes, searchResults, timeTick]);

  const filtered = useMemo(() => {
    if (query.trim()) {
      return searchResults.filter(r => {
        if (verifiedOnly && !r.verified) return false;
        if (typeFilter !== 'all' && r.busType !== typeFilter && r.type !== typeFilter) return false;
        return true;
      });
    }

    // No search query - filter from routes
    return routes.filter(r => {
      if (verifiedOnly && !r.verified) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      return true;
    });
  }, [routes, searchResults, query, typeFilter, verifiedOnly]);

  const greeting = getGreeting();

  // Helper to persist recent queries
  const saveRecent = useCallback((q) => {
    try {
      const trimmed = q.trim();
      if (!trimmed) return;
      const next = [trimmed, ...recentSearches.filter(x => x !== trimmed)].slice(0, 6);
      setRecentSearches(next);
      localStorage.setItem('recentBusSearches', JSON.stringify(next));
    } catch { }
  }, [recentSearches]);

  // Increment a search count for popularity computation
  const incrementSearchCount = useCallback((q) => {
    try {
      const trimmed = q.trim();
      if (!trimmed) return;
      const next = { ...searchCounts, [trimmed]: (searchCounts[trimmed] || 0) + 1 };
      setSearchCounts(next);
      localStorage.setItem('busSearchCounts', JSON.stringify(next));
    } catch { }
  }, [searchCounts]);

  const triggerSearch = useCallback((q) => {
    setQuery(q);
    saveRecent(q);
    incrementSearchCount(q);
    if (onSearch) onSearch(q);
  }, [onSearch, saveRecent, incrementSearchCount]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchMode === 'general' && query.trim()) {
      triggerSearch(query.trim());
    } else if (searchMode === 'directional' && fromLocation.trim() && toLocation.trim()) {
      const directionalQuery = `${fromLocation.trim()} → ${toLocation.trim()}`;
      saveRecent(directionalQuery);
      incrementSearchCount(directionalQuery);
      if (onSearch) onSearch(directionalQuery);
    }
  };

  const handleDirectionalSearchSubmit = (e) => {
    e.preventDefault();
    if (fromLocation.trim() && toLocation.trim()) {
      const directionalQuery = `${fromLocation.trim()} → ${toLocation.trim()}`;
      saveRecent(directionalQuery);
      incrementSearchCount(directionalQuery);
      if (onSearch) onSearch(directionalQuery);
    }
  };

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

  // Autocomplete logic
  const commonDestinations = useMemo(() => ({
    Colombo: ['Kandy', 'Jaffna', 'Galle', 'Matara', 'Negombo', 'Badulla'],
    Kandy: ['Colombo', 'Nuwara Eliya', 'Kurunegala'],
    Jaffna: ['Colombo', 'Vavuniya'],
    Galle: ['Colombo', 'Matara'],
  }), []);

  const buildSuggestions = useCallback((text) => {
    const t = text.trim();
    if (!t) return [];

    const items = new Set();
    const lower = t.toLowerCase();

    // From routes list
    routes.forEach(r => {
      const from = r.from || r.origin;
      const to = r.to || r.destination;
      const license = r.licenseNo || r.busNumber;
      const company = r.companyName || r.company;

      if (from && to) {
        const pair = `${from} → ${to}`;
        const pairAlt = `${to} → ${from}`;
        if (pair.toLowerCase().includes(lower)) items.add(pair);
        if (pairAlt.toLowerCase().includes(lower)) items.add(pairAlt);
        if (from.toLowerCase().startsWith(lower)) {
          const targets = commonDestinations[from] || [];
          targets.forEach(dst => items.add(`${from} → ${dst}`));
        }
        if (to.toLowerCase().startsWith(lower)) {
          const targets = commonDestinations[to] || [];
          targets.forEach(dst => items.add(`${to} → ${dst}`));
        }
      }
      if (license && license.toLowerCase().includes(lower)) items.add(license);
      if (company && company.toLowerCase().includes(lower)) items.add(company);
    });

    // Curated shortcuts when a city typed
    Object.keys(commonDestinations).forEach(city => {
      if (city.toLowerCase().startsWith(lower)) {
        commonDestinations[city].forEach(dst => items.add(`${city} → ${dst}`));
      }
    });

    return Array.from(items).slice(0, 8);
  }, [routes, commonDestinations]);

  // Position for suggestions
  const [suggestionsPosition, setSuggestionsPosition] = useState(0);

  // Update suggestions position when showing them
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current) {
      const rect = suggestionsRef.current.getBoundingClientRect();
      setSuggestionsPosition(rect.bottom + window.scrollY);
    }
  }, [showSuggestions]);

  // Hide suggestions on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!suggestionsRef.current) return;
      if (!suggestionsRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <div className="home">
      <h2 className="home__greeting">Good {greeting}, {user?.name || 'Traveler'}</h2>
      <p className="home__sub">Find reliable bus routes and verified bus info across Sri Lanka</p>

      {/* Search Mode Toggle */}
      <div className="home__search-mode-toggle">
        <button
          type="button"
          className={`search-mode-btn ${searchMode === 'general' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('general');
            setSearchResults([]);
            setSearchError(null);
          }}
        >
          General Search
        </button>
        <button
          type="button"
          className={`search-mode-btn ${searchMode === 'directional' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('directional');
            setSearchResults([]);
            setSearchError(null);
          }}
        >
          Route Search
        </button>
      </div>

      {/* General Search Form */}
      {searchMode === 'general' && (
        <form className="home__searchbar" onSubmit={handleSearchSubmit} ref={suggestionsRef}>
          <input
            type="text"
            placeholder="Search routes, destinations, bus numbers..."
            value={query}
            onFocus={() => {
              setSuggestions(buildSuggestions(query));
              setShowSuggestions(true);
            }}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              setSuggestions(buildSuggestions(v));
              setShowSuggestions(true);
            }}
            aria-label="Search bus routes"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="home__suggestions"
              role="listbox"
              style={{ top: `${suggestionsPosition}px` }}
            >
              {suggestions.map((s, i) => (
                <li
                  key={s + i}
                  role="option"
                  className="home__suggestion-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    triggerSearch(s);
                    setShowSuggestions(false);
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {/* Directional Search Form */}
      {searchMode === 'directional' && (
        <form className="home__directional-search" onSubmit={handleDirectionalSearchSubmit}>
          <div className="directional-search-inputs">
            <div className="location-input-group">
              <label htmlFor="from-location">From</label>
              <input
                id="from-location"
                type="text"
                placeholder="Starting location (e.g., Colombo)"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                aria-label="Starting location"
              />
            </div>
            <div className="search-arrow" aria-hidden="true">→</div>
            <div className="location-input-group">
              <label htmlFor="to-location">To</label>
              <input
                id="to-location"
                type="text"
                placeholder="Destination (e.g., Jaffna)"
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                aria-label="Destination location"
              />
            </div>
            <button
              type="submit"
              className="directional-search-btn"
              disabled={!fromLocation.trim() || !toLocation.trim()}
            >
              Search Routes
            </button>
          </div>
        </form>
      )}

      {searchError && (
        <div style={{
          color: 'var(--home-error)',
          textAlign: 'center',
          margin: '1rem 0',
          padding: '0.75rem',
          backgroundColor: 'rgba(185, 28, 28, 0.1)',
          borderRadius: '0.5rem',
          fontSize: '0.9rem'
        }}>
          {searchError}
        </div>
      )}

      {/* Quick Categories removed to avoid duplication with filters */}

      <div className="home__filters">
        {['luxury', 'semi', 'normal'].map(t => (
          <button
            key={t}
            className={'home__filter-btn' + (typeFilter === t ? ' active' : '')}
            onClick={() => setTypeFilter(prev => (prev === t ? 'all' : t))}
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
        >When enabled, only routes verified by the community are shown.</span>
      </label>

      <h3 className="home__section-title">Popular Bus Routes</h3>
      <PopularRoutes
        routes={routes}
        verifiedPopular={popular}
        searchCounts={searchCounts}
        onPick={(label) => triggerSearch(label)}
        badgeClass={badgeClass}
        getVerificationText={getVerificationText}
      />

      {/* Recent searches - styled like route boxes */}
      {recentSearches.length > 0 && (
        <>
          <h3 className="home__section-title">Recent Searches</h3>
          <ul className="home__popular-list">
            {recentSearches.map((q) => (
              <li
                key={q}
                className="home__popular-item"
                onClick={() => triggerSearch(q)}
                role="button"
              >
                <span className="home__popular-code">{q}</span>
                <span>Tap to search this route</span>
                <span className={badgeClass(false, true)}>Quick Search</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Transit Statistics section removed as requested */}
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

// Subcomponent: PopularRoutes
function PopularRoutes({ routes, verifiedPopular, searchCounts, onPick, badgeClass, getVerificationText }) {
  // Build a map from a route label to count based on saved searchCounts
  const ranked = React.useMemo(() => {
    // Only consider existing routes
    const labels = routes.map(r => r.name ? r.name : `${r.from} → ${r.to}`);
    const unique = Array.from(new Set(labels));
    const withScores = unique.map(label => ({ label, score: searchCounts[label] || 0 }));
    // Sort by score desc
    withScores.sort((a, b) => b.score - a.score);
    // Take top 6 with score > 0
    return withScores.filter(x => x.score > 0).slice(0, 6);
  }, [routes, searchCounts]);

  // Fallback to verifiedPopular (existing verified routes) if ranked is empty
  const items = ranked.length > 0 ? ranked.map(r => ({ label: r.label })) : verifiedPopular.map(r => ({ label: r.name ? r.name : `${r.from} → ${r.to}`, verified: r.verified }));

  if (!items || items.length === 0) {
    return (
      <ul className="home__popular-list">
        <li className="home__popular-item">
          <span className="home__popular-code">No Routes</span>
          <span>No popular bus routes available at this time</span>
          <span className={badgeClass(false, true)}>Check back later</span>
        </li>
      </ul>
    );
  }

  return (
    <ul className="home__popular-list">
      {items.map((it, idx) => (
        <li
          key={it.label + idx}
          className="home__popular-item"
          onClick={() => onPick(it.label)}
          role="button"
        >
          <span className="home__popular-code">{it.label}</span>
          <span>Explore buses and schedules</span>
          <span className={badgeClass(!!it.verified)}>
            {it.verified ? getVerificationText(true) : 'Popular'}
          </span>
        </li>
      ))}
    </ul>
  );
}