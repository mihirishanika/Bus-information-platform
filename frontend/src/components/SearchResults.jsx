import React, { useMemo, useRef, useState, useEffect } from 'react';
import './SearchResults.css';
import { searchBuses, voteBusVerification, getBus, verifyBus, reportBus, getUserVote } from '../api';
import { BiBus, BiMapAlt, BiMoneyWithdraw, BiSolidUser } from 'react-icons/bi';
import { AiFillSchedule } from 'react-icons/ai';
import { IoTime } from 'react-icons/io5';
import { LuBus } from 'react-icons/lu';
import { FaRegCircleStop, FaUserTie } from 'react-icons/fa6';
import { MdVerifiedUser, MdReport } from 'react-icons/md';
import { BsPersonFillCheck } from 'react-icons/bs';
import { FiChevronRight, FiChevronDown } from 'react-icons/fi';

export default function SearchResults({ query, onBack }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDirectional, setIsDirectional] = useState(false);
  const [actionStates, setActionStates] = useState({}); // For verify/report loading states
  const [userVotes, setUserVotes] = useState({}); // Track user's actual votes from DB: busId -> 'verify'|'report'|null
  const [galleryIndex, setGalleryIndex] = useState({}); // busId -> index
  const [expanded, setExpanded] = useState({}); // busId -> boolean
  const touchStartX = useRef({});
  const touchDeltaX = useRef({});

  // React icon fallback renderer
  const Placeholder = () => (
    <div className="sr-gallery__default">
      <BiBus className="sr-gallery__default-icon" aria-hidden />
      <span className="sr-gallery__default-text">No image</span>
    </div>
  );

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
      const buses = response.buses || [];
      // Check if this is a directional search result
      setIsDirectional(response.directional || false);

      // Initialize counts if they don't exist
      const busesWithCounts = buses.map(bus => ({
        ...bus,
        verifyCount: bus.verifyCount || 0,
        reportCount: bus.reportCount || 0,
      }));
      setResults(busesWithCounts);

      // Load user votes for all buses
      busesWithCounts.forEach(async (bus) => {
        try {
          const busId = bus.licenseNo || bus.id;
          const voteData = await getUserVote(bus.licenseNo || bus.busNumber);
          setUserVotes(prev => ({
            ...prev,
            [busId]: voteData.hasVoted ? voteData.voteType : null
          }));
        } catch (e) {
          // User might not be logged in or vote doesn't exist
          console.log('Could not load user vote:', e.message);
        }
      });

      // Proactively fetch images for buses missing them
      // but don't block UI; fetch in background and merge
      buses.forEach(async (bus) => {
        const rawImages = Array.isArray(bus.photos)
          ? bus.photos
          : (Array.isArray(bus.images) ? bus.images : []);
        if (!rawImages || rawImages.length === 0) {
          try {
            const detail = await getBus(bus.licenseNo || bus.id || bus.busNumber);
            const newImages = (detail?.photos || detail?.images || []).filter(Boolean);
            if (newImages.length > 0) {
              setResults(prev => prev.map(b =>
                (b.licenseNo === bus.licenseNo || b.id === bus.id)
                  ? { ...b, photos: newImages }
                  : b
              ));
            }
          } catch (e) {
            // ignore per-bus image errors
          }
        }
      });
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Format query nicely e.g., "Colombo to Jaffna" -> "Colombo → Jaffna"
  const formattedQuery = useMemo(() => {
    const q = (query || '').trim();
    if (!q) return '';
    // replace common separators with an arrow
    return q.replace(/\s*(-|>|to|TO|To)\s*/g, ' → ');
  }, [query]);

  // Helpers for image gallery
  const nextImage = (busId, total) => {
    setGalleryIndex(prev => ({ ...prev, [busId]: ((prev[busId] ?? 0) + 1) % total }));
  };
  const prevImage = (busId, total) => {
    setGalleryIndex(prev => ({ ...prev, [busId]: ((prev[busId] ?? 0) - 1 + total) % total }));
  };

  const onTouchStart = (e, busId) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartX.current[busId] = touch.clientX;
    touchDeltaX.current[busId] = 0;
  };
  const onTouchMove = (e, busId) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    const start = touchStartX.current[busId];
    if (start == null) return;
    touchDeltaX.current[busId] = touch.clientX - start;
  };
  const onTouchEnd = (busId, total) => {
    const dx = touchDeltaX.current[busId] || 0;
    const threshold = 30; // pixels
    if (Math.abs(dx) > threshold) {
      if (dx < 0) nextImage(busId, total); else prevImage(busId, total);
    }
    delete touchStartX.current[busId];
    delete touchDeltaX.current[busId];
  };

  const handleVerify = async (bus) => {
    const busId = bus.licenseNo || bus.id;
    const currentVote = userVotes[busId];

    setActionStates(prev => ({ ...prev, [busId]: 'verify' }));

    try {
      // Call the API first
      const response = await verifyBus(bus.licenseNo || bus.busNumber);

      // Update local state based on API response
      const { verifyDelta, reportDelta } = response;

      // Update vote counts
      setResults(prev => prev.map(b =>
        (b.licenseNo === bus.licenseNo || b.id === bus.id)
          ? {
            ...b,
            verifyCount: Math.max((b.verifyCount || 0) + verifyDelta, 0),
            reportCount: Math.max((b.reportCount || 0) + reportDelta, 0)
          }
          : b
      ));

      // Update user vote state
      if (currentVote === 'verify') {
        // User removed their verify vote
        setUserVotes(prev => ({ ...prev, [busId]: null }));
      } else {
        // User added or changed to verify vote
        setUserVotes(prev => ({ ...prev, [busId]: 'verify' }));
      }

    } catch (err) {
      console.error('Verify error:', err);
      // Show error to user (you could add a toast notification here)
    } finally {
      setActionStates(prev => ({ ...prev, [busId]: null }));
    }
  };

  const handleReport = async (bus) => {
    const busId = bus.licenseNo || bus.id;
    const currentVote = userVotes[busId];

    setActionStates(prev => ({ ...prev, [busId]: 'report' }));

    try {
      // Call the API first
      const response = await reportBus(bus.licenseNo || bus.busNumber);

      // Update local state based on API response
      const { verifyDelta, reportDelta } = response;

      // Update vote counts
      setResults(prev => prev.map(b =>
        (b.licenseNo === bus.licenseNo || b.id === bus.id)
          ? {
            ...b,
            verifyCount: Math.max((b.verifyCount || 0) + verifyDelta, 0),
            reportCount: Math.max((b.reportCount || 0) + reportDelta, 0)
          }
          : b
      ));

      // Update user vote state
      if (currentVote === 'report') {
        // User removed their report vote
        setUserVotes(prev => ({ ...prev, [busId]: null }));
      } else {
        // User added or changed to report vote
        setUserVotes(prev => ({ ...prev, [busId]: 'report' }));
      }

    } catch (err) {
      console.error('Report error:', err);
      // Show error to user (you could add a toast notification here)
    } finally {
      setActionStates(prev => ({ ...prev, [busId]: null }));
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
        <button className="search-results__back" onClick={onBack} aria-label="Go back">
          <span className="back-icon" aria-hidden>←</span>
          <span className="back-text">Back</span>
        </button>
        <h2 className="search-results__title">Bus Search Results</h2>
      </div>
      <div className="search-results__summary" aria-live="polite">
        <div className="summary-chip">
          <span className="summary-count">{results.length}</span>
          <span className="summary-text">result{results.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="summary-query">
          <BiMapAlt className="summary-icon" aria-hidden />
          <span>
            for <strong>"{formattedQuery || query}"</strong>
            {isDirectional && <span className="directional-badge">Route Search</span>}
          </span>
        </div>
      </div>
      <div className="search-results__list">
        {results.map(bus => {
          const busId = bus.licenseNo || bus.id;
          const currentAction = actionStates[busId];
          const userVote = userVotes[busId];
          const verified = bus.verified || (bus.verifyCount || 0) >= 3;
          const rawImages = Array.isArray(bus.photos)
            ? bus.photos
            : (Array.isArray(bus.images) ? bus.images : []);
          const images = (rawImages || [])
            .map(it => typeof it === 'string' ? it : (it?.url || it?.src || ''))
            .filter(Boolean);
          const current = Math.min(galleryIndex[busId] ?? 0, Math.max(images.length - 1, 0));
          const hasGallery = images.length > 0;

          const removeImageAt = (idx) => {
            setResults(prev => prev.map(b => {
              const id = b.licenseNo || b.id;
              if (id !== busId) return b;
              const from = Array.isArray(b.photos) ? 'photos' : (Array.isArray(b.images) ? 'images' : 'photos');
              const arr = (b[from] || []).slice();
              // normalize again when comparing
              const mapped = arr.map(it => typeof it === 'string' ? it : (it?.url || it?.src || ''));
              // find the actual index of the failing src in original array by matching mapped order
              const actualIdx = idx;
              arr.splice(actualIdx, 1);
              return { ...b, [from]: arr };
            }));
          };

          const plate = bus.busNumber || bus.licenseNo || '—';
          // Use the name returned by directional search if available, otherwise fallback
          const name = bus.name || bus.companyName || '';
          const routeFrom = bus.from || '';
          const routeTo = bus.to || '';

          // Show directional information if available
          const searchDirection = bus.searchDirection;
          const isDirectionalResult = isDirectional && bus.direction;

          // Extract times from journeys array based on search direction
          let journeys = [];

          if (isDirectional && bus.relevantJourneys) {
            // Use the relevant journeys returned by directional search
            journeys = bus.relevantJourneys || [];
          } else {
            // Use all journeys for general search
            journeys = bus.journeys || [];
          }

          // For display in summary: show first journey times, or fallback to legacy fields
          const firstJourney = journeys[0] || {};
          const depTime = firstJourney.start || bus.departureTime || bus.startTime || bus.departTime || null;
          const arrTime = firstJourney.end || bus.arrivalTime || bus.endTime || null; const isOpen = !!expanded[busId];

          return (
            <div key={busId} className="search-results__card">
              {/* Summary row (compact) */}
              <button
                type="button"
                className={`sr-item__summary ${isOpen ? 'open' : ''}`}
                aria-expanded={isOpen}
                onClick={() => {
                  if (isOpen) {
                    // If clicking on already open item, close it
                    setExpanded(prev => ({ ...prev, [busId]: false }));
                  } else {
                    // If clicking on closed item, close all others and open this one
                    setExpanded({ [busId]: true });
                  }
                }}
              >
                <div className="sr-item__main">
                  <div className="sr-item__route-main">
                    {name || bus.companyName || 'Company not specified'}
                  </div>
                  <div className="sr-item__bus-info">
                    <span className="sr-item__plate">{plate}</span>
                    {bus.companyName && <span className="sr-item__name">{bus.companyName}</span>}
                  </div>
                  {bus.journeyDuration && (
                    <div className="sr-item__duration">
                      <span className="duration-badge" title="Journey duration">
                        {bus.journeyDuration}
                      </span>
                    </div>
                  )}
                </div>
                <div className="sr-item__times">
                  {journeys.length > 0 ? (
                    // Show all journey times consistently in grouped format
                    <div className="journey-times-container">
                      {journeys.map((journey, idx) => (
                        <div key={idx} className="journey-group">
                          {journeys.length > 1 && (
                            <span className="journey-number">Journey {idx + 1}</span>
                          )}
                          <div className="journey-times">
                            <span className="time-chip departure-chip" title={`Journey ${idx + 1} - Departure time`}>
                              <AiFillSchedule className="icon" aria-hidden />
                              <span className="time-value">{journey.start || 'No time'}</span>
                            </span>
                            <span className="journey-arrow" aria-hidden>→</span>
                            <span className="time-chip arrival-chip" title={`Journey ${idx + 1} - Arrival time`}>
                              <IoTime className="icon" aria-hidden />
                              <span className="time-value">{journey.end || 'No time'}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Fallback to legacy fields if no journeys array
                    <div className="journey-times-container">
                      <div className="journey-group">
                        <div className="journey-times">
                          <span className="time-chip departure-chip" title="Departure time">
                            <AiFillSchedule className="icon" aria-hidden />
                            <span className="time-value">{depTime || 'No time'}</span>
                          </span>
                          <span className="journey-arrow" aria-hidden>→</span>
                          <span className="time-chip arrival-chip" title="Arrival time">
                            <IoTime className="icon" aria-hidden />
                            <span className="time-value">{arrTime || 'No time'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="sr-item__chevron" aria-hidden>
                  {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                </div>
              </button>

              {/* Details (expanded) */}
              {isOpen && (
                <div className="search-results__details">
                  <div className="sr-gallery" aria-label="Bus photos">
                    <div
                      className="sr-gallery__main"
                      onTouchStart={(e) => onTouchStart(e, busId)}
                      onTouchMove={(e) => onTouchMove(e, busId)}
                      onTouchEnd={() => onTouchEnd(busId, images.length)}
                    >
                      {images.length > 1 && (
                        <button
                          type="button"
                          className="sr-gallery__nav sr-gallery__nav--left"
                          onClick={() => prevImage(busId, images.length)}
                          aria-label="Previous image"
                        >‹</button>
                      )}
                      {hasGallery ? (
                        <img
                          src={images[current]}
                          alt={`Bus photo ${current + 1}`}
                          loading="lazy"
                          decoding="async"
                          onError={() => removeImageAt(current)}
                        />
                      ) : (
                        <Placeholder />
                      )}
                      {images.length > 1 && (
                        <button
                          type="button"
                          className="sr-gallery__nav sr-gallery__nav--right"
                          onClick={() => nextImage(busId, images.length)}
                          aria-label="Next image"
                        >›</button>
                      )}
                    </div>
                    {images.length > 1 && (
                      <div className="sr-gallery__thumbs">
                        {images.map((src, idx) => (
                          <img
                            key={src + idx}
                            src={src}
                            alt={`Thumbnail ${idx + 1}`}
                            className={idx === current ? 'active' : ''}
                            onClick={() => setGalleryIndex(prev => ({ ...prev, [busId]: idx }))}
                            loading="lazy"
                            decoding="async"
                            onError={() => removeImageAt(idx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="search-results__header">
                    <span className="search-results__bus-number">
                      {bus.busNumber || bus.licenseNo}
                    </span>
                    <span className="search-results__company">{bus.companyName}</span>
                  </div>

                  <div className="search-results__route">
                    <BiMapAlt className="icon" aria-hidden />
                    <span className="route-seg from">{bus.from}</span>
                    <span className="route-arrow" aria-hidden>→</span>
                    <span className="route-seg to">{bus.to}</span>
                  </div>

                  <div className="search-results__meta">
                    <span className="info-chip"><AiFillSchedule className="icon" aria-hidden />{bus.dailyDepartures || 0} departures/day</span>
                    <span className="info-chip"><IoTime className="icon" aria-hidden />{bus.journeyDuration || '—'}</span>
                    {bus.adultFare != null && <span className="info-chip"><BiMoneyWithdraw className="icon" aria-hidden />Adult Fare: LKR {bus.adultFare}</span>}
                    {bus.childFare != null && <span className="info-chip"><BiMoneyWithdraw className="icon" aria-hidden />Child Fare: LKR {bus.childFare}</span>}
                    {bus.seatCount != null && <span className="info-chip"><BiSolidUser className="icon" aria-hidden />{bus.seatCount} seats</span>}
                    {bus.year != null && <span className="info-chip">Year: {bus.year}</span>}
                    <span className={`info-chip search-results__bus-type ${bus.busType}`}>
                      <LuBus className="icon" aria-hidden />
                      {bus.busType === 'luxury' ? 'Luxury AC' :
                        bus.busType === 'semi' ? 'Semi Luxury' : 'Standard'}
                    </span>
                  </div>

                  {bus.stops && bus.stops.length > 0 && (
                    <div className="search-results__stops">
                      <FaRegCircleStop className="icon" aria-hidden />
                      <strong>Stops:</strong> {bus.stops.join(', ')}
                    </div>
                  )}

                  <div className="search-results__action-row">
                    <div className="action-badges">
                      <span className={`search-results__badge verify-badge ${verified ? 'verified' : ''}`}>
                        <MdVerifiedUser className="icon" aria-hidden />
                        {bus.verifyCount || 0} verif{(bus.verifyCount || 0) === 1 ? 'y' : 'ies'}
                      </span>
                      <span className="search-results__badge report-badge">
                        <MdReport className="icon" aria-hidden />
                        {bus.reportCount || 0} report{(bus.reportCount || 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="action-buttons">
                      <button
                        className={`search-results__action-btn verify-btn ${userVote === 'verify' ? 'active' : ''}`}
                        onClick={() => handleVerify(bus)}
                        disabled={currentAction === 'verify'}
                      >
                        <MdVerifiedUser className="btn-icon" />
                        {currentAction === 'verify' ? 'Verifying...' :
                          userVote === 'verify' ? 'Verified' : 'Verify'}
                      </button>
                      <button
                        className={`search-results__action-btn report-btn ${userVote === 'report' ? 'active' : ''}`}
                        onClick={() => handleReport(bus)}
                        disabled={currentAction === 'report'}
                      >
                        <MdReport className="btn-icon" />
                        {currentAction === 'report' ? 'Reporting...' :
                          userVote === 'report' ? 'Reported' : 'Report'}
                      </button>
                    </div>
                  </div>

                  {bus.contacts && (
                    <div className="search-results__contacts">
                      {bus.contacts.driver && (
                        <span className="contact-item"><FaUserTie className="icon" aria-hidden />Driver: {bus.contacts.driver}</span>
                      )}
                      {bus.contacts.conductor && (
                        <span className="contact-item"><BiSolidUser className="icon" aria-hidden />Conductor: {bus.contacts.conductor}</span>
                      )}
                      {bus.contacts.booking && (
                        <span className="contact-item"><BsPersonFillCheck className="icon" aria-hidden />Booking: {bus.contacts.booking}</span>
                      )}
                    </div>
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