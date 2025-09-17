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
    fetch(`${apiBase}/next?routeId=${route.id}`)
      .then(r => r.json())
      .then(data => {
        setArrival(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [route, apiBase]);

  if (loading) return <p>Loading...</p>;
  if (error) return <div className="next-bus__error" style={{maxWidth:400}}>{error}</div>;
  if (!arrival) return <p>No data.</p>;

  return (
    <div className="next-bus">
      <h3 className="next-bus__title">Next Bus</h3>
      <div className="next-bus__panel">
        <p className="next-bus__eta"><strong>Route:</strong> {route.code} – {route.name}</p>
        <p className="next-bus__eta"><strong>Next Bus In:</strong> {arrival.nextArrivalMins} mins</p>
        <p className="next-bus__eta"><strong>Updated At:</strong> {new Date(arrival.generatedAt).toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
