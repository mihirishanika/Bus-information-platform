import React from 'react';
import './BottomNav.css';

/*
Props:
- active: 'home' | 'browse' | 'add' | 'verify' | 'profile' | 'search'
- onChange: (key) => void
*/
export default function BottomNav({ active, onChange = () => { } }) {
    const Item = ({ id, label, icon }) => {
        const isActive = active === id;
        return (
            <button
                className={`bn-item ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => onChange(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
            >
                <span className="bn-icon" aria-hidden>
                    {icon}
                </span>
                <span className="bn-label">{label}</span>
            </button>
        );
    };

    return (
        <>
            {/* Spacer ensures page content isn't hidden behind fixed nav */}
            <div className="bottom-nav-spacer" aria-hidden="true" />
            <nav className="bottom-nav" role="navigation" aria-label="Bottom navigation">
                <Item id="home" label="Home" icon={
                    // Home icon
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 10.5L12 3l9 7.5" />
                        <path d="M5 10v10h14V10" />
                    </svg>
                } />
                <Item id="browse" label="Browse" icon={
                    // Search icon
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                } />
                <Item id="add" label="Add" icon={
                    // Plus icon
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                } />
                <Item id="verify" label="Verify" icon={
                    // Shield check
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l7 3v6c0 5-3.5 9-7 11-3.5-2-7-6-7-11V5l7-3z" />
                        <path d="M9 12l2 2 4-4" />
                    </svg>
                } />
                <Item id="profile" label="Profile" icon={
                    // User icon
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M6 20c0-3.3137 2.6863-6 6-6s6 2.6863 6 6" />
                    </svg>
                } />
            </nav>
        </>
    );
}
