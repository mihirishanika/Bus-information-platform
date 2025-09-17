import React, { useMemo } from 'react';
import './SearchResults.css';
import { searchBuses, upvoteVerification } from '../busStore';

export default function SearchResults({ query, onBack }) {
  const results = useMemo(() => query ? searchBuses(query) : [], [query]);

  const handleUpvote = (id) => {
    upvoteVerification(id);
  };

  return (
    <div className="search-results">
      <div className="search-results__bar">
        <button className="search-results__back" onClick={onBack}>← Back</button>
        <h2 className="search-results__title">Search Results</h2>
      </div>
      <p className="search-results__summary">{results.length} result{results.length!==1 && 's'} for "{query}"</p>
      <div className="search-results__list">
        {results.map(bus => (
          <div key={bus.id} className="search-results__card">
            <div className="search-results__header">
              <span className="search-results__bus-number">{bus.busNumber}</span>
              <span className="search-results__company">{bus.companyName}</span>
            </div>
            <div className="search-results__route">{bus.from} → {bus.to}</div>
            <div className="search-results__meta">
              <span>{bus.dailyDepartures} departures / day</span>
              <span>{bus.journeyDuration || '—'}</span>
              {bus.adultFare != null && <span>LKR {bus.adultFare}</span>}
            </div>
            <div className="search-results__verify-row">
              <span className={"search-results__badge" + (bus.verifiedVotes>0 ? ' verified' : '')}>{bus.verifiedVotes} vote{bus.verifiedVotes!==1 && 's'}</span>
              <button className="search-results__vote-btn" onClick={()=>handleUpvote(bus.id)}>+ Vote</button>
            </div>
          </div>
        ))}
        {results.length === 0 && (
          <div className="search-results__empty">No buses matched that query.</div>
        )}
      </div>
    </div>
  );
}
