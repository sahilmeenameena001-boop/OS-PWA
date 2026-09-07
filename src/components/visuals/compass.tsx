/** Layered SVG "3D" personal compass: calendar, memory and savings symbols orbit a floating dial. */
export function CompassHero({ size = 260 }: { size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size, perspective: 900 }} aria-hidden="true">
      <div className="anim-float absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        <svg viewBox="0 0 260 260" width={size} height={size} className="absolute inset-0" style={{ transform: "rotateX(12deg)" }}>
          <defs>
            <radialGradient id="c-dial" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="var(--card)" />
              <stop offset="1" stopColor="var(--muted)" />
            </radialGradient>
            <linearGradient id="c-rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--primary)" />
              <stop offset="1" stopColor="var(--violet)" />
            </linearGradient>
            <filter id="c-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000" floodOpacity="0.35" />
            </filter>
          </defs>
          <ellipse cx="130" cy="236" rx="80" ry="12" fill="#000" fillOpacity="0.25" />
          <circle cx="130" cy="130" r="108" fill="url(#c-rim)" filter="url(#c-shadow)" />
          <circle cx="130" cy="134" r="100" fill="#0a0f1f" fillOpacity="0.35" />
          <circle cx="130" cy="130" r="96" fill="url(#c-dial)" stroke="var(--border)" strokeWidth="2" />
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i * 10 * Math.PI) / 180;
            const major = i % 9 === 0;
            const r1 = major ? 80 : 86;
            return <line key={i} x1={130 + Math.cos(a) * r1} y1={130 + Math.sin(a) * r1} x2={130 + Math.cos(a) * 92} y2={130 + Math.sin(a) * 92} stroke="currentColor" strokeOpacity={major ? 0.6 : 0.25} strokeWidth={major ? 2 : 1} />;
          })}
          <g style={{ transformOrigin: "130px 130px", animation: "spin-slow 24s linear infinite" }}>
            <path d="M130 60 L142 130 L130 200 L118 130 Z" fill="var(--coral)" />
            <path d="M130 60 L142 130 L118 130 Z" fill="var(--primary)" />
            <circle cx="130" cy="130" r="9" fill="var(--card)" stroke="var(--primary)" strokeWidth="3" />
          </g>
        </svg>
        {/* Orbiting symbols on a raised layer */}
        <svg viewBox="0 0 260 260" width={size} height={size} className="absolute inset-0" style={{ transform: "translateZ(40px)" }}>
          <g transform="translate(130 36)">
            <circle r="20" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" />
            <rect x="-9" y="-8" width="18" height="16" rx="3" fill="none" stroke="var(--primary)" strokeWidth="2" />
            <path d="M-9 -3h18M-4 -11v5M4 -11v5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(46 180)">
            <circle r="20" fill="var(--card)" stroke="var(--violet)" strokeWidth="2" />
            <path d="M-8 -7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" fill="none" stroke="var(--violet)" strokeWidth="2" />
            <path d="M-4 -3h8M-4 1h8M-4 5h4" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(214 180)">
            <circle r="20" fill="var(--card)" stroke="var(--mint)" strokeWidth="2" />
            <path d="M-8 -3h16v10a3 3 0 0 1-3 3h-10a3 3 0 0 1-3-3z" fill="var(--mint)" fillOpacity="0.25" stroke="var(--mint)" strokeWidth="2" />
            <path d="M-5 -3v-2a5 5 0 0 1 10 0v2" fill="none" stroke="var(--mint)" strokeWidth="2" />
          </g>
        </svg>
      </div>
      <style>{`@keyframes spin-slow{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
