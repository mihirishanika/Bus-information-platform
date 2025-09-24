import React, { useEffect, useState } from 'react';
import './Verify.css';
import { listBuses, verifyBus } from '../api';

export default function Verify({ onVerified }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchNewBuses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listBuses();

      // Filter to only show buses with no verifies or reports
      const newBuses = response.buses.filter(bus =>
        (bus.verifyCount === 0 || bus.verifyCount === undefined) &&
        (bus.reportCount === 0 || bus.reportCount === undefined)
      );

      // Transform to match the component's expected format
      const formattedBuses = newBuses.map(bus => ({
        id: bus.id || bus.licenseNo,
        busNumber: bus.busNumber || bus.licenseNo,
        licenseNo: bus.licenseNo,
        companyName: bus.companyName,
        from: bus.from,
        to: bus.to,
        submitter: bus.submitter || 'Unknown',
        submittedAt: new Date(bus.createdAt || Date.now()).getTime(),
        status: 'pending'
      }));

      setItems(formattedBuses);
    } catch (err) {
      console.error('Error fetching new buses:', err);
      setError('Failed to load new buses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewBuses();
  }, []);

  const markVerified = async (id) => {
    try {
      // Find the bus by id
      const bus = items.find(item => item.id === id);
      if (!bus) return;

      // Call the API to verify the bus
      await verifyBus(bus.licenseNo);

      // Update local state
      setItems(list => list.filter(i => i.id !== id));

      // Show success message
      setSuccessMessage(`Bus ${bus.busNumber} has been verified successfully!`);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

      // Call the parent callback if provided
      onVerified && onVerified(id);
    } catch (err) {
      console.error('Error verifying bus:', err);
      setError('Failed to verify the bus. Please try again.');
    }
  };

  return (
    <div className="verify page-wrapper">
      <h2 className="verify__title">New Buses for Verification</h2>
      <div className="verify__pending-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <p className="verify__section-label" style={{ margin: 0 }}>New Buses</p>
          <button
            onClick={fetchNewBuses}
            disabled={loading}
            className="verify__btn"
          >
            {loading ? 'Loading...' : 'Refresh List'}
          </button>
        </div>

        {loading && (
          <div className="verify__loading">Loading new buses...</div>
        )}

        {error && (
          <div className="verify__error">{error}</div>
        )}

        {successMessage && (
          <div className="verify__success">{successMessage}</div>
        )}

        <ul className="verify__list">
          {items.map(item => (
            <li key={item.id} className="verify__item">
              <div className="verify__bus">Bus Number: {item.busNumber}</div>
              <div className="verify__route">
                Route: {item.from} → {item.to}
              </div>
              <div className="verify__meta">
                <span>Company: {item.companyName}</span>
                <span>License No: {item.licenseNo}</span>
                <span>Added: {new Date(item.submittedAt).toLocaleString()}</span>
              </div>
              <div className="verify__btn-row">
                <button className="verify__btn" onClick={() => markVerified(item.id)}>Verify</button>
              </div>
            </li>
          ))}
          {!loading && items.length === 0 && (
            <li className="verify__empty">No new buses to verify.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
