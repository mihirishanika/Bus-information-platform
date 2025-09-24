import React, { useEffect, useState } from 'react';
import './NextBus.css';

export default function NextBus({ route, apiBase }) {
  const [arrival, setArrival] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!route) return;
    setLoading(true);
    setError(null);
    // Backend expects ?route=CODE or ?code=CODE
    const code = encodeURIComponent(route.code || route.id || '');
    fetch(`${apiBase}/next?route=${code}`)
      .then(r => r.json())
      .then(data => {
        // Support backend shape: { route:{}, next:{ minutesUntil, nextTime, ended? } }
        if (data && data.next) {
          setArrival({
            nextArrivalMins: data.next.minutesUntil,
            nextTime: data.next.nextTime,
            ended: data.next.ended,
            generatedAt: new Date().toISOString()
          });
        } else {
          // Fallback to old/demo shape
          setArrival({
            nextArrivalMins: data.nextArrivalMins ?? null,
            generatedAt: data.generatedAt ?? new Date().toISOString()
          });
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [route, apiBase]);

  if (loading) return <p>Loading...</p>;
  if (error) return <div className="next-bus__error" style={{ maxWidth: 400 }}>{error}</div>;
  if (!arrival) return <p>No data.</p>;

  return (
    <div className="next-bus">
      <h3 className="next-bus__title">Next Bus</h3>
      <div className="next-bus__panel">
        <p className="next-bus__eta"><strong>Route:</strong> {route.code} – {route.name || `${route.from} → ${route.to}`}</p>
        {arrival.ended ? (
          <p className="next-bus__eta"><strong>Service:</strong> Ended for today</p>
        ) : (
          <>
            {typeof arrival.nextArrivalMins === 'number' && (
              <p className="next-bus__eta"><strong>Next Bus In:</strong> {arrival.nextArrivalMins} mins</p>
            )}
            {arrival.nextTime && (
              <p className="next-bus__eta"><strong>At:</strong> {arrival.nextTime}</p>
            )}
          </>
        )}
        <p className="next-bus__eta"><strong>Updated At:</strong> {new Date(arrival.generatedAt).toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
