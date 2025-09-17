import React from 'react';

// Basic list; filtering will be applied before passing routes prop.
export default function RoutesList({ routes, selected, onSelect }) {
	if (!routes || routes.length === 0) {
		return <p className="no-routes">No routes available.</p>;
	}
	return (
		<ul className="routes-list">
			{routes.map(r => (
				<li key={r.id}>
					<button
						className={"btn-route" + (selected && selected.id === r.id ? ' selected' : '')}
						onClick={() => onSelect(r)}
					>
						<strong>{r.code}</strong> – {r.name}
					</button>
				</li>
			))}
		</ul>
	);
}
