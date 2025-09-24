import React, { useEffect, useState } from 'react';
import './App.css';
import RoutesList from './components/RoutesList';
import NextBus from './components/NextBus';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import AddBus from './components/AddBus';
import Profile from './components/Profile';
import Verify from './components/Verify';
import Browse from './components/Browse';
import SearchResults from './components/SearchResults';
import { currentUser, logout } from './auth';
import { listBuses } from './api';
import BottomNav from './components/BottomNav';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function App() {
	const [user, setUser] = useState(null);
	const [routes, setRoutes] = useState([]);
	const [selected, setSelected] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState('login'); // login | register | app
	const [subview, setSubview] = useState('home'); // home | browse | add | verify | profile | search
	const [searchQuery, setSearchQuery] = useState('');

	// Check for authenticated user on app load
	useEffect(() => {
		const checkAuth = async () => {
			try {
				const u = await currentUser();
				if (u) {
					setUser(u);
					setView('app');
				}
			} catch (err) {
				console.log('No authenticated user found:', err);
				// User not authenticated, stay on login
			} finally {
				setLoading(false);
			}
		};

		checkAuth();
	}, []);

	// Fetch bus routes when entering app
	useEffect(() => {
		if (view !== 'app') return;

		const fetchRoutes = async () => {
			try {
				// Try to fetch from new API endpoint first
				const response = await listBuses({ limit: 100 });
				const buses = response.buses || [];

				// Transform buses to routes format for compatibility
				const transformedRoutes = buses.map(bus => ({
					id: bus.id || bus.licenseNo,
					code: bus.busNumber || bus.licenseNo,
					name: `${bus.from} → ${bus.to}`,
					from: bus.from,
					to: bus.to,
					type: bus.busType || 'normal',
					verified: bus.verified || (bus.verifiedVotes && bus.verifiedVotes >= 3),
					verifiedVotes: bus.verifiedVotes || 0,
					popular: bus.verified || (bus.verifiedVotes && bus.verifiedVotes >= 2),
					headwayMins: 15, // Default headway
					dailyDepartures: bus.dailyDepartures || 0,
					...bus // Include all other bus properties
				}));

				setRoutes(transformedRoutes);
			} catch (e) {
				console.error('Failed to fetch routes:', e);

				// Fallback to legacy API endpoint
				try {
					const response = await fetch(`${API_BASE}/routes`);
					const data = await response.json();
					setRoutes(data.routes || []);
				} catch (fallbackError) {
					console.error('Fallback route fetch also failed:', fallbackError);
					setError('Failed to load bus routes. Please try again later.');
				}
			}
		};

		fetchRoutes();
	}, [view]);

	const handleAuthed = (u) => {
		setUser(u);
		setView('app');
		setSubview('home');
		setError(null);
	};

	const handleLogout = async () => {
		try {
			await logout();
		} catch (err) {
			console.error('Logout error:', err);
		} finally {
			// Always clear local state regardless of logout success
			setUser(null);
			setSelected(null);
			setRoutes([]);
			setSubview('home');
			setView('login');
			setError(null);
		}
	};

	const handleBusSubmit = (savedBus) => {
		console.log('Bus saved:', savedBus);

		// Add the new bus to routes for immediate visibility
		if (savedBus) {
			const newRoute = {
				id: savedBus.id || savedBus.licenseNo,
				code: savedBus.busNumber || savedBus.licenseNo,
				name: `${savedBus.from} → ${savedBus.to}`,
				from: savedBus.from,
				to: savedBus.to,
				type: savedBus.busType || 'normal',
				verified: false,
				verifiedVotes: 0,
				popular: false,
				headwayMins: 15,
				dailyDepartures: savedBus.dailyDepartures || 0,
				...savedBus
			};

			setRoutes(prev => {
				// Check if bus already exists (in case of update)
				const exists = prev.find(r => r.id === newRoute.id || r.code === newRoute.code);
				if (exists) {
					// Update existing
					return prev.map(r => r.id === newRoute.id || r.code === newRoute.code ? newRoute : r);
				} else {
					// Add new
					return [newRoute, ...prev];
				}
			});
		}

		// Navigate back to home to see the result
		setSubview('home');
	};

	// Show loading screen while checking authentication
	if (loading) {
		return (
			<div className="app-container">
				<div style={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100vh',
					flexDirection: 'column',
					gap: '1rem'
				}}>
					<div style={{
						width: '40px',
						height: '40px',
						border: '3px solid var(--home-border-light)',
						borderTop: '3px solid var(--home-primary)',
						borderRadius: '50%',
						animation: 'spin 1s linear infinite'
					}}></div>
					<p style={{ color: 'var(--home-text-secondary)' }}>Loading BUS INFO LK...</p>
				</div>
			</div>
		);
	}

	// Authentication views
	if (view === 'login') {
		return <Login onSuccess={handleAuthed} goRegister={() => setView('register')} />;
	}
	if (view === 'register') {
		return <Register onSuccess={handleAuthed} goLogin={() => setView('login')} />;
	}

	// Main app content
	let content = null;
	try {
		if (subview === 'home') {
			content = (
				<Home
					user={user}
					routes={routes}
					onSearch={(q) => {
						setSearchQuery(q);
						setSubview('search');
					}}
				/>
			);
		} else if (subview === 'browse') {
			content = (
				<Browse
					routes={routes}
					selected={selected}
					onSelect={setSelected}
					apiBase={API_BASE}
					onSearch={(q) => {
						setSearchQuery(q);
						setSubview('search');
					}}
				/>
			);
		} else if (subview === 'add') {
			content = (
				<AddBus
					onSubmit={handleBusSubmit}
				/>
			);
		} else if (subview === 'verify') {
			content = <Verify />;
		} else if (subview === 'profile') {
			content = (
				<Profile
					user={user}
					onUpdate={(u) => setUser(u)}
					onLogout={handleLogout}
				/>
			);
		} else if (subview === 'search') {
			content = (
				<SearchResults
					query={searchQuery}
					onBack={() => setSubview('home')}
				/>
			);
		}
	} catch (err) {
		console.error('Error rendering content:', err);
		content = (
			<div style={{
				textAlign: 'center',
				padding: '3rem',
				color: 'var(--home-error)'
			}}>
				Error loading content. Please try refreshing the page.
			</div>
		);
	}

	return (
		<div className="app-container">
			<header className="app-header">
				<h1
					style={{ cursor: 'pointer' }}
					onClick={() => setSubview('home')}
				>
					BUS INFO LK
				</h1>
			</header>

			{error && (
				<div style={{
					color: 'var(--home-error)',
					padding: '1rem',
					textAlign: 'center',
					backgroundColor: 'rgba(185, 28, 28, 0.1)',
					margin: '0 1rem',
					borderRadius: '0.5rem'
				}}>
					{error}
				</div>
			)}

			{content}

			{view === 'app' && (
				<BottomNav active={subview} onChange={setSubview} />
			)}

			<style jsx>{`
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	);
}