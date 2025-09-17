import React from 'react';
import './Landing.css';

export default function Landing({ onStart }) {
  return (
    <div className="landing-root">
      <div className="landing-inner">
        <h1 className="landing-title">BUS INFO LK</h1>
        <p className="landing-tagline">Reliable Sri Lanka bus route & timing information platform.</p>
        <button className="btn-primary landing-start" onClick={onStart}>Get Started</button>
      </div>
    </div>
  );
}
