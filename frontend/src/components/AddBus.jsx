import React, { useCallback, useMemo, useState } from 'react';
import './AddBus.css';
import { addBus } from '../busStore';

// Local (client-side) bus info creation form. Does not persist to backend yet.
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
  const [dailyDepartures, setDailyDepartures] = useState('');
  const [journeyDuration, setJourneyDuration] = useState('');
  const [fareAdult, setFareAdult] = useState('');
  const [fareChild, setFareChild] = useState('');
  const [contactDriver, setContactDriver] = useState('');
  const [contactConductor, setContactConductor] = useState('');
  const [contactBooking, setContactBooking] = useState('');
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({length: 35}, (_, i) => String(current - i));
  }, []);

  const routePlaces = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Matara', 'Kurunegala'];

  const validate = useCallback(() => {
    const errs = [];
    if (!companyName.trim()) errs.push('Company name required');
    if (!licenseNo.trim()) errs.push('License number required');
    if (!seatCount || isNaN(Number(seatCount))) errs.push('Seat count must be a number');
    if (!year) errs.push('Manufacture year required');
    if (!from) errs.push('From location required');
    if (!to) errs.push('To location required');
    if (from && to && from === to) errs.push('From and To cannot be same');
    if (!dailyDepartures || isNaN(Number(dailyDepartures))) errs.push('Daily departures must be numeric');
    if (fareAdult && isNaN(Number(fareAdult))) errs.push('Adult fare must be numeric');
    if (fareChild && isNaN(Number(fareChild))) errs.push('Child fare must be numeric');
    if (contactDriver && contactDriver.length < 7) errs.push('Driver number too short');
    return errs;
  }, [companyName, licenseNo, seatCount, year, from, to, dailyDepartures, fareAdult, fareChild, contactDriver]);

  const handleAddStop = () => {
    if (!newStop.trim()) return;
    setStops(s => [...s, newStop.trim()]);
    setNewStop('');
  };
  const handleRemoveStop = (idx) => {
    setStops(s => s.filter((_, i) => i !== idx));
  };

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files || []);
    const readers = files.map(f => new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res({ name: f.name, data: reader.result });
      reader.readAsDataURL(f);
    }));
    Promise.all(readers).then(list => setPhotos(p => [...p, ...list]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors([]); setSuccess(false);
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setSubmitting(true);
    const payload = {
      busNumber: licenseNo.trim(),
      companyName: companyName.trim(),
      busType,
      seatCount: Number(seatCount),
      year: Number(year),
      from,
      to,
      stops,
      dailyDepartures: Number(dailyDepartures),
      journeyDuration,
      adultFare: fareAdult ? Number(fareAdult) : null,
      childFare: fareChild ? Number(fareChild) : null,
      contacts: { driver:contactDriver, conductor:contactConductor, booking:contactBooking },
      photos
    };
    try {
      const created = addBus(payload);
      setSubmitting(false);
      setSuccess(true);
      onSubmit && onSubmit(created);
    } catch (e) {
      setSubmitting(false);
      setErrors(["Failed to save bus locally: "+ e.message]);
    }
  };

  return (
  <form className="add-bus page-wrapper" onSubmit={handleSubmit}>
  <h2 className="add-bus__title">Add Bus Information</h2>
      {errors.length > 0 && (
        <div className="add-bus__errors">
          {errors.map((er,i) => <div key={i}>{er}</div>)}
        </div>
      )}
  {success && <div className="add-bus__success">Bus saved to local storage. It will appear in search results.</div>}

      <section className="add-bus__section">
        <h3>Company Information</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">Company Name
            <input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Ex: SuperLine Pvt" />
          </label>
          <label className="add-bus__field">Bus License No
            <input value={licenseNo} onChange={e=>setLicenseNo(e.target.value)} placeholder="NC-1234" />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3>Bus Type & Specs</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">Bus Type
            <select value={busType} onChange={e=>setBusType(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="semi">Semi Luxury</option>
              <option value="luxury">Luxury / AC</option>
            </select>
          </label>
          <label className="add-bus__field">Seat Count
            <input value={seatCount} onChange={e=>setSeatCount(e.target.value)} placeholder="50" />
          </label>
          <label className="add-bus__field">Manufacture Year
            <select value={year} onChange={e=>setYear(e.target.value)}>
              <option value="">-- Year --</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3>Route Information</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">From
            <select value={from} onChange={e=>setFrom(e.target.value)}>
              <option value="">-- Select --</option>
              {routePlaces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="add-bus__field">To
            <select value={to} onChange={e=>setTo(e.target.value)}>
              <option value="">-- Select --</option>
              {routePlaces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <div className="add-bus__stops" style={{marginTop:'0.75rem'}}>
          <div className="add-bus__inline">
            <input style={{flex:1}} placeholder="Add route stop" value={newStop} onChange={e=>setNewStop(e.target.value)} />
            <button type="button" className="add-bus__add-stop" onClick={handleAddStop}>Add Stop</button>
          </div>
          {stops.map((s,i) => (
            <div key={i} className="add-bus__stop-item">
              <input style={{flex:1}} value={s} readOnly />
              <button type="button" className="add-bus__remove-btn" onClick={() => handleRemoveStop(i)}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section className="add-bus__section">
        <h3>Timetable</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">Daily Departures
            <input value={dailyDepartures} onChange={e=>setDailyDepartures(e.target.value)} placeholder="6" />
          </label>
          <label className="add-bus__field">Journey Duration
            <input value={journeyDuration} onChange={e=>setJourneyDuration(e.target.value)} placeholder="4h 30m" />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3>Fare Details</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">Adult Fare (LKR)
            <input value={fareAdult} onChange={e=>setFareAdult(e.target.value)} placeholder="450" />
          </label>
          <label className="add-bus__field">Child Fare (LKR)
            <input value={fareChild} onChange={e=>setFareChild(e.target.value)} placeholder="250" />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3>Contact Numbers</h3>
        <div className="add-bus__grid">
          <label className="add-bus__field">Driver
            <input value={contactDriver} onChange={e=>setContactDriver(e.target.value)} placeholder="0771234567" />
          </label>
          <label className="add-bus__field">Conductor
            <input value={contactConductor} onChange={e=>setContactConductor(e.target.value)} placeholder="0719876543" />
          </label>
          <label className="add-bus__field">Booking
            <input value={contactBooking} onChange={e=>setContactBooking(e.target.value)} placeholder="0112558899" />
          </label>
        </div>
      </section>

      <section className="add-bus__section">
        <h3>Bus Photos</h3>
        <div className="add-bus__field">
          <span style={{fontSize:'0.6rem', letterSpacing:'.5px'}}>Add Photo(s)</span>
          <input type="file" accept="image/*" multiple className="add-bus__photo-input" onChange={handlePhotos} />
        </div>
        {photos.length > 0 && (
          <div className="add-bus__file-preview">
            {photos.map((p,i) => <img src={p.data} alt={p.name} key={i} />)}
          </div>
        )}
      </section>

      <button className="add-bus__submit" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Bus Information'}</button>
    </form>
  );
}
