import React, { useEffect, useState } from 'react';
import './App.css';
import RoutesList from './components/RoutesList';
import NextBus from './components/NextBus';
import Landing from './components/Landing';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import AddBus from './components/AddBus';
import Profile from './components/Profile';
import Verify from './components/Verify';
import Browse from './components/Browse';
import SearchResults from './components/SearchResults';
import { currentUser, logout } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function App() {
	const [routes, setRoutes] = useState([]);
	const [selected, setSelected] = useState(null);
	const [error, setError] = useState(null);
	const [view, setView] = useState('landing'); // landing | login | register | app
	const [subview, setSubview] = useState('home'); // home | browse | add | verify | profile | search
	const [searchQuery, setSearchQuery] = useState('');
	const [user, setUser] = useState(currentUser());

	// Fetch routes when entering app
	useEffect(() => {
		if (view !== 'app') return;
		fetch(`${API_BASE}/routes`)
			.then(r => r.json())
			.then(data => setRoutes(data.routes || []))
			.catch(e => setError(e.message));
	}, [view]);

	const handleAuthed = (u) => {
		setUser(u);
		setView('app');
		setSubview('home');
	};

	const handleLogout = () => {
		logout();
		setUser(null);
		setSelected(null);
		setRoutes([]);
		setSubview('home');
		setView('landing');
	};

	if (view === 'landing') {
		return <Landing onStart={() => (user ? setView('app') : setView('login'))} />;
	}
	if (view === 'login') {
		return <Login onSuccess={handleAuthed} goRegister={() => setView('register')} goLanding={() => setView('landing')} />;
	}
	if (view === 'register') {
		return <Register onSuccess={handleAuthed} goLogin={() => setView('login')} goLanding={() => setView('landing')} />;
	}

	let content = null;
	if (subview === 'home') {
		content = <Home user={user} routes={routes} onSearch={(q)=>{ setSearchQuery(q); setSubview('search'); }} />;
		} else if (subview === 'browse') {
			content = <Browse routes={routes} selected={selected} onSelect={setSelected} apiBase={API_BASE} onSearch={(q)=>{ setSearchQuery(q); setSubview('search'); }} />;
	} else if (subview === 'add') {
		content = <AddBus onSubmit={(payload) => console.log('Bus saved locally', payload)} />;
		} else if (subview === 'verify') {
			content = <Verify />;
		} else if (subview === 'profile') {
			content = <Profile user={user} onUpdate={(u)=>setUser(u)} onLogout={handleLogout} />;
		} else if (subview === 'search') {
			content = <SearchResults query={searchQuery} onBack={()=> setSubview('home')} />;
	}

	return (
		<div className="app-container">
			<header className="app-header">
				<h1 style={{cursor:'pointer'}} onClick={() => setSubview('home')}>BUS INFO LK</h1>
				<nav style={{display:'flex', gap:'0.75rem', alignItems:'center'}}>
					<button onClick={() => setSubview('home')} className={subview==='home'?'nav-active':'nav-btn'}>Home</button>
					<button onClick={() => setSubview('browse')} className={subview==='browse'?'nav-active':'nav-btn'}>Browse</button>
					<button onClick={() => setSubview('add')} className={subview==='add'?'nav-active':'nav-btn'}>Add</button>
					<button onClick={() => setSubview('verify')} className={subview==='verify'?'nav-active':'nav-btn'}>Verify</button>
					<button onClick={() => setSubview('profile')} className={subview==='profile'?'nav-active':'nav-btn'}>Profile</button>
					{searchQuery && subview==='search' && <span className="header-user">Query: {searchQuery}</span>}
					<span className="header-user">{user?.email}</span>
					<button onClick={handleLogout} className="btn-danger">Logout</button>
				</nav>
			</header>
			{error && <p style={{color:'red'}}>{error}</p>}
			{content}
		</div>
	);
}
