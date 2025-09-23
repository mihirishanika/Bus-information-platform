import React, { useMemo, useState } from 'react';
import './SearchResults.css';
import { searchBuses, voteBusVerification } from '../api';

export default function SearchResults({ query, onBack }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [votingStates, setVotingStates] = useState({});

  // Fetch results when component mounts or query changes
  React.useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await searchBuses(query);
      setResults(response.buses || []);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (bus) => {
    const busId = bus.licenseNo || bus.id;
    setVotingStates(prev => ({ ...prev, [busId]: true }));

    try {
      await voteBusVerification(bus.licenseNo || bus.busNumber);

      // Update local state to reflect the vote
      setResults(prev => prev.map(b =>
        (b.licenseNo === bus.licenseNo || b.id === bus.id)
          ? { ...b, verifiedVotes: (b.verifiedVotes || 0) + 1 }
          : b
      ));
    } catch (err) {
      console.error('Vote error:', err);
      // Could show a toast notification here
    } finally {
      setVotingStates(prev => ({ ...prev, [busId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="search-results">
        <div className="search-results__bar">
          <button className="search-results__back" onClick={onBack}>← Back</button>
          <h2 className="search-results__title">Search Results</h2>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--home-text-secondary)' }}>
          Searching for buses...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-results">
        <div className="search-results__bar">
          <button className="search-results__back" onClick={onBack}>← Back</button>
          <h2 className="search-results__title">Search Results</h2>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--home-error)',
          backgroundColor: 'rgba(185, 28, 28, 0.1)',
          borderRadius: '0.5rem',
          margin: '1rem'
        }}>
          {error}
          <br />
          <button
            onClick={performSearch}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'var(--home-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results">
      <div className="search-results__bar">
        <button className="search-results__back" onClick={onBack}>← Back</button>
        <h2 className="search-results__title">Bus Search Results</h2>
      </div>
      <p className="search-results__summary">
        {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
      </p>
      <div className="search-results__list">
        {results.map(bus => {
          const busId = bus.licenseNo || bus.id;
          const isVoting = votingStates[busId];
          const verified = bus.verified || (bus.verifiedVotes || 0) >= 3;

          return (
            <div key={busId} className="search-results__card">
              <div className="search-results__header">
                <span className="search-results__bus-number">
                  {bus.busNumber || bus.licenseNo}
                </span>
                <span className="search-results__company">{bus.companyName}</span>
              </div>

              <div className="search-results__route">
                {bus.from} → {bus.to}
              </div>

              <div className="search-results__meta">
                <span>{bus.dailyDepartures || 0} departures / day</span>
                <span>{bus.journeyDuration || '—'}</span>
                {bus.adultFare != null && <span>LKR {bus.adultFare}</span>}
                <span className={`search-results__bus-type ${bus.busType}`}>
                  {bus.busType === 'luxury' ? 'Luxury AC' :
                    bus.busType === 'semi' ? 'Semi Luxury' : 'Standard'}
                </span>
              </div>

              {bus.stops && bus.stops.length > 0 && (
                <div className="search-results__stops">
                  <strong>Stops:</strong> {bus.stops.slice(0, 3).join(', ')}
                  {bus.stops.length > 3 && ` (+${bus.stops.length - 3} more)`}
                </div>
              )}

              <div className="search-results__verify-row">
                <span className={`search-results__badge ${verified ? 'verified' : ''}`}>
                  {bus.verifiedVotes || 0} vote{(bus.verifiedVotes || 0) !== 1 ? 's' : ''}
                  {verified && ' ✓'}
                </span>
                <button
                  className="search-results__vote-btn"
                  onClick={() => handleUpvote(bus)}
                  disabled={isVoting}
                >
                  {isVoting ? 'Voting...' : '+ Vote'}
                </button>
              </div>

              {bus.contacts && (
                <div className="search-results__contacts">
                  {bus.contacts.driver && (
                    <span>Driver: {bus.contacts.driver}</span>
                  )}
                  {bus.contacts.conductor && (
                    <span>Conductor: {bus.contacts.conductor}</span>
                  )}
                  {bus.contacts.booking && (
                    <span>Booking: {bus.contacts.booking}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {results.length === 0 && !loading && (
          <div className="search-results__empty">
            No buses found matching "{query}". Try a different search term or check spelling.
          </div>
        )}
      </div>
    </div>
  );
}