import React from 'react';

export default function GlassNavCard({ icon, label, title, sub, color, onClick, coverUrl }) {
  return (
    <div className="glass-nav-card" data-tone={color} onClick={onClick}>
      <div className="card-label">{label}</div>
      <div className="card-title">{title || label}</div>
      {sub && <div className="card-sub">{sub}</div>}
      
      {coverUrl ? (
        <div className="card-art" style={{ backgroundImage: `url(${coverUrl})` }} />
      ) : (
        <div className="card-art" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.15)' }}>
          {icon && React.cloneElement(icon, { size: 64 })}
        </div>
      )}
    </div>
  );
}
