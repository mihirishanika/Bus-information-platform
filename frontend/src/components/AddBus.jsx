import React, { useCallback, useMemo, useState } from 'react';
import './AddBus.css';
import { addBus } from '../busStore';
import { createBus } from '../api';

// Bus information creation form with proper API integration
export default function AddBus({ onSubmit }) {
  const [companyName, setCompanyName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [busType, setBusType] = useState('normal');
  const [seatCount, setSeatCount] = useState('');
  const [year, setYear] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stops, setStops] = useState([]);
  const [newStop, setNewStop] = useState('');
  // Journeys: list of { start, end }
  const [journeys, setJourneys] = useState([{ start: '', end: '' }]);
  const [journeyDuration, setJourneyDuration] = useState('');
  const [fareAdult, setFareAdult] = useState('');
  const [fareChild, setFareChild] = useState('');
  const [contactDriver, setContactDriver] = useState('');
  const [contactConductor, setContactConductor] = useState('');
  const [contactBooking, setContactBooking] = useState('');
  const [photos, setPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 35 }, (_, i) => String(current - i));
  }, []);

  const validate = useCallback(() => {
    const errs = [];
    if (!companyName.trim()) errs.push('Company name required');
    if (!licenseNo.trim()) errs.push('License number required');
    if (!seatCount || isNaN(Number(seatCount))) errs.push('Seat count must be a number');
    if (!year) errs.push('Manufacture year required');
    if (!from.trim()) errs.push('From location required');
    if (!to.trim()) errs.push('To location required');
    if (from && to && from.trim() === to.trim()) errs.push('From and To cannot be same');
    const filledJourneys = (journeys || []).filter(j => j.start && j.end);
    if (filledJourneys.length === 0) errs.push('Add at least one journey start and end time');
    if (fareAdult && isNaN(Number(fareAdult))) errs.push('Adult fare must be numeric');
    if (fareChild && isNaN(Number(fareChild))) errs.push('Child fare must be numeric');
    if (contactDriver && contactDriver.length < 10) errs.push('Driver number must be at least 10 digits');
    return errs;
  }, [companyName, licenseNo, seatCount, year, from, to, journeys, fareAdult, fareChild, contactDriver]);

  const handleAddStop = () => {
    if (!newStop.trim()) return;
    setStops(s => [...s, newStop.trim()]);
    setNewStop('');
  };

  const handleRemoveStop = (idx) => {
    setStops(s => s.filter((_, i) => i !== idx));
  };

  const readFilesToDataUrls = (files) => {
    const list = Array.from(files || []);
    const readers = list.map(f => new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res({ name: f.name, data: reader.result });
      reader.readAsDataURL(f);
    }));
    return Promise.all(readers);
  };

  const handlePhotos = (eOrFiles) => {
    const files = eOrFiles?.target?.files ?? eOrFiles ?? [];
    readFilesToDataUrls(files).then(list => setPhotos(p => [...p, ...list]));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      handlePhotos(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleRemovePhoto = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setSuccess(false);

    const errs = validate();
    if (errs.length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);

    try {
      const filledJourneys = (journeys || []).filter(j => j.start && j.end);

      // Build payload according to your API structure
      const payload = {
        // Primary identifiers
        busNumber: licenseNo.trim(),
        licenseNo: licenseNo.trim(), // Ensure both fields are set
        companyName: companyName.trim(),

        // Route information
        from: from.trim(),
        to: to.trim(),
        stops: stops,
        route: `${from.trim()} → ${to.trim()}`, // For GSI searching

        // Bus specifications
        busType,
        seatCount: Number(seatCount),
        year: Number(year),

        // Schedule and fare
        journeys: filledJourneys,
        dailyDepartures: filledJourneys.length,
        journeyDuration: journeyDuration.trim() || null,
        adultFare: fareAdult ? Number(fareAdult) : null,
        childFare: fareChild ? Number(fareChild) : null,

        // Contact information
        contacts: {
          driver: contactDriver.trim() || null,
          conductor: contactConductor.trim() || null,
          booking: contactBooking.trim() || null
        },

        // Media
        photos: photos,

        // Metadata
        verified: false,
        verifiedVotes: 0,
        createdAt: new Date().toISOString(),
        id: `bus_${licenseNo.trim()}_${Date.now()}`
      };

      // Remove null/empty values to keep payload clean
      Object.keys(payload).forEach(key => {
        if (payload[key] === null || payload[key] === '') {
          delete payload[key];
        }
      });

      // Try API first, fallback to localStorage
      let savedBus = null;
      let apiSuccess = false;

      try {
        const response = await createBus(payload);
        savedBus = response.bus || response;
        apiSuccess = true;
        setSuccess(true);
        console.log('Bus saved to API successfully:', savedBus);
      } catch (apiErr) {
        console.warn('API createBus failed, falling back to localStorage:', apiErr);

        // Fallback to localStorage
        try {
          savedBus = addBus(payload);
          setSuccess(true);
          console.log('Bus saved to localStorage as fallback:', savedBus);
        } catch (localErr) {
          throw new Error(`Both API and localStorage failed. API: ${apiErr.message}, Local: ${localErr.message}`);
        }
      }

      // Clear form on success
      setCompanyName('');
      setLicenseNo('');
      setBusType('normal');
      setSeatCount('');
      setYear('');
      setFrom('');
      setTo('');
      setStops([]);
      setJourneys([{ start: '', end: '' }]);
      setJourneyDuration('');
      setFareAdult('');
      setFareChild('');
      setContactDriver('');
      setContactConductor('');
      setContactBooking('');
      setPhotos([]);

      // Call parent callback
      if (onSubmit && savedBus) {
        onSubmit(savedBus);
      }

    } catch (error) {
      console.error('Bus save error:', error);
      setErrors([error.message || 'Failed to save bus information. Please try again.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="add-bus page-wrapper" onSubmit={handleSubmit}>
      <h2 className="add-bus__title">Add Bus Information</h2>

      {errors.length > 0 && (
        <div className="add-bus__errors">
          {errors.map((err, i) => (
            <div key={i} style={{ color: 'var(--home-error)', marginBottom: '0.5rem' }}>
              • {err}
            </div>
          ))}
        </div>
      )}

      {success && (
        <div className="add-bus__success" style={{
          color: 'var(--home-success)',
          backgroundColor: 'rgba(21, 128, 61, 0.1)',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem'
        }}>
          ✓ Bus information saved successfully! It will appear in search results.
        </div>
      )}

      <section className="add-bus__section">
        <h3 className="home__section-title">Company Information</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">
            Company Name *
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Ex: SuperLine Express Pvt Ltd"
              required
            />
          </label>
          <label className="add-bus__field">
            Bus License Number *
            <input
              value={licenseNo}
              onChange={e => setLicenseNo(e.target.value)}
              placeholder="Ex: NC-1234, NA-8899"
              required
            />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3 className="home__section-title">Bus Specifications</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">
            Bus Type *
            <select value={busType} onChange={e => setBusType(e.target.value)} required>
              <option value="normal">Standard</option>
              <option value="semi">Semi Luxury</option>
              <option value="luxury">Luxury AC</option>
            </select>
          </label>
          <label className="add-bus__field">
            Seat Count *
            <input
              type="number"
              value={seatCount}
              onChange={e => setSeatCount(e.target.value)}
              placeholder="45"
              min="10"
              max="100"
              required
            />
          </label>
          <label className="add-bus__field">
            Manufacture Year *
            <select value={year} onChange={e => setYear(e.target.value)} required>
              <option value="">-- Select Year --</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3 className="home__section-title">Route Information</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">
            From (Starting Point) *
            <input
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder="Ex: Colombo, Kandy, Galle"
              required
            />
          </label>
          <label className="add-bus__field">
            To (Destination) *
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="Ex: Kandy, Galle, Jaffna"
              required
            />
          </label>
        </div>
        <div className="add-bus__stops" style={{ marginTop: '0.75rem' }}>
          <div className="add-bus__inline">
            <input
              style={{ flex: 1 }}
              placeholder="Add intermediate stop"
              value={newStop}
              onChange={e => setNewStop(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddStop())}
            />
            <button type="button" className="add-bus__add-stop" onClick={handleAddStop}>
              Add Stop
            </button>
          </div>
          {stops.map((stop, i) => (
            <div key={i} className="add-bus__stop-item">
              <input style={{ flex: 1 }} value={stop} readOnly />
              <button
                type="button"
                className="add-bus__remove-btn"
                onClick={() => handleRemoveStop(i)}
                aria-label={`Remove stop: ${stop}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="add-bus__section">
        <h3 className="home__section-title">Schedule & Timetable</h3>
        <div className="add-bus__journeys">
          {journeys.map((journey, idx) => (
            <div key={idx} className="add-bus__journey-row">
              <label className="add-bus__field">
                Journey {idx + 1} - Start Time
                <input
                  type="time"
                  value={journey.start}
                  onChange={e => {
                    const value = e.target.value;
                    setJourneys(prev => prev.map((item, i) =>
                      i === idx ? { ...item, start: value } : item
                    ));
                  }}
                />
              </label>
              <label className="add-bus__field">
                Journey {idx + 1} - End Time
                <input
                  type="time"
                  value={journey.end}
                  onChange={e => {
                    const value = e.target.value;
                    setJourneys(prev => prev.map((item, i) =>
                      i === idx ? { ...item, end: value } : item
                    ));
                  }}
                />
              </label>
              {journeys.length > 1 && (
                <button
                  type="button"
                  className="add-bus__remove-btn"
                  onClick={() => setJourneys(prev => prev.filter((_, i) => i !== idx))}
                  style={{ alignSelf: 'center' }}
                >
                  Remove Journey
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="add-bus__add-journey"
            onClick={() => setJourneys(prev => [...prev, { start: '', end: '' }])}
          >
            + Add Another Journey
          </button>
        </div>
        <div className="add-bus__grid" style={{ marginTop: '1rem' }}>
          <label className="add-bus__field">
            Journey Duration (Optional)
            <input
              value={journeyDuration}
              onChange={e => setJourneyDuration(e.target.value)}
              placeholder="Ex: 4h 30m, 2 hours 15 minutes"
            />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3 className="home__section-title">Fare Information</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">
            Adult Fare (LKR)
            <input
              type="number"
              value={fareAdult}
              onChange={e => setFareAdult(e.target.value)}
              placeholder="1200"
              min="0"
              step="10"
            />
          </label>
          <label className="add-bus__field">
            Child Fare (LKR)
            <input
              type="number"
              value={fareChild}
              onChange={e => setFareChild(e.target.value)}
              placeholder="600"
              min="0"
              step="10"
            />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3 className="home__section-title">Contact Information</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">
            Driver Contact
            <input
              type="tel"
              value={contactDriver}
              onChange={e => setContactDriver(e.target.value)}
              placeholder="0771234567"
            />
          </label>
          <label className="add-bus__field">
            Conductor Contact
            <input
              type="tel"
              value={contactConductor}
              onChange={e => setContactConductor(e.target.value)}
              placeholder="0779876543"
            />
          </label>
          <label className="add-bus__field">
            Booking Office
            <input
              type="tel"
              value={contactBooking}
              onChange={e => setContactBooking(e.target.value)}
              placeholder="0112345678"
            />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3 className="home__section-title">Bus Photos (Optional)</h3>
        <div className="add-bus__photos">
          <label
            htmlFor="bus-photos"
            className={`add-bus__photo-dropzone ${isDragging ? 'add-bus__photo-dropzone--active' : ''}`}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="add-bus__photo-dropzone-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 7a2 2 0 0 1 2-2h2.172a2 2 0 0 0 1.414-.586L10.414 5H14a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="add-bus__photo-dropzone-text">
              <strong>Click to upload photos</strong>
              <span>or drag & drop</span>
            </div>
            <input
              id="bus-photos"
              type="file"
              accept="image/*"
              multiple
              className="add-bus__file-input add-bus__file-input--hidden"
              onChange={handlePhotos}
            />
          </label>
          <div className="add-bus__photo-hint">PNG, JPG up to 5MB each</div>
          {photos.length > 0 && (
            <div className="add-bus__photo-count">
              {photos.length} photo{photos.length > 1 ? 's' : ''} selected
            </div>
          )}
        </div>
        {photos.length > 0 && (
          <div className="add-bus__file-preview">
            {photos.map((photo, i) => (
              <div className="add-bus__thumb" key={i}>
                <img src={photo.data} alt={photo.name || `Bus photo ${i + 1}`} />
                <button
                  type="button"
                  className="add-bus__photo-remove"
                  aria-label={`Remove ${photo.name || `photo ${i + 1}`}`}
                  onClick={() => handleRemovePhoto(i)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 7h12M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m-7 0v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        className="add-bus__submit"
        type="submit"
        disabled={submitting}
        style={{
          opacity: submitting ? 0.7 : 1,
          cursor: submitting ? 'not-allowed' : 'pointer'
        }}
      >
        {submitting ? 'Saving Bus Information...' : 'Save Bus Information'}
      </button>
    </form>
  );
}