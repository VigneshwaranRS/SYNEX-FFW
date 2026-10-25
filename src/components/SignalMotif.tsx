/**
 * SignalMotif — Pure SVG/CSS geometric illustration.
 * Inspired by signal routing, circuit traces, and event control systems.
 * Purely decorative; aria-hidden by design.
 */
export default function SignalMotif({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Grid dots */}
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: 10 }).map((_, col) => (
          <circle
            key={`dot-${row}-${col}`}
            cx={col * 60 + 30}
            cy={row * 60 + 20}
            r="1.5"
            fill="#2e2e28"
          />
        ))
      )}

      {/* Routing lines — horizontal */}
      <line x1="30"  y1="80"  x2="570" y2="80"  stroke="#2e2e28" strokeWidth="0.5"/>
      <line x1="30"  y1="200" x2="570" y2="200" stroke="#2e2e28" strokeWidth="0.5"/>
      <line x1="30"  y1="320" x2="570" y2="320" stroke="#2e2e28" strokeWidth="0.5"/>

      {/* Routing lines — vertical */}
      <line x1="150" y1="20" x2="150" y2="380" stroke="#2e2e28" strokeWidth="0.5"/>
      <line x1="300" y1="20" x2="300" y2="380" stroke="#2e2e28" strokeWidth="0.5"/>
      <line x1="450" y1="20" x2="450" y2="380" stroke="#2e2e28" strokeWidth="0.5"/>

      {/* Active signal path — accent lime */}
      <polyline
        points="30,200 90,200 90,140 210,140 210,260 330,260 330,140 390,140 390,200 570,200"
        stroke="#b8ff00"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Signal nodes */}
      <circle cx="90"  cy="200" r="5" fill="#0c0c0a" stroke="#b8ff00" strokeWidth="1.5"/>
      <circle cx="210" cy="140" r="5" fill="#0c0c0a" stroke="#b8ff00" strokeWidth="1.5"/>
      <circle cx="210" cy="260" r="5" fill="#0c0c0a" stroke="#b8ff00" strokeWidth="1.5"/>
      <circle cx="330" cy="260" r="5" fill="#0c0c0a" stroke="#b8ff00" strokeWidth="1.5"/>
      <circle cx="330" cy="140" r="5" fill="#0c0c0a" stroke="#b8ff00" strokeWidth="1.5"/>
      <circle cx="390" cy="140" r="5" fill="#0c0c0a" stroke="#b8ff00" strokeWidth="1.5"/>

      {/* Active terminal node — filled */}
      <circle cx="390" cy="200" r="7" fill="#b8ff00"/>

      {/* Coordinate labels */}
      <text x="36" y="76"  fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#2e2e28">00×00</text>
      <text x="36" y="196" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#2e2e28">00×03</text>
      <text x="36" y="316" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#2e2e28">00×06</text>
      <text x="156" y="76" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#2e2e28">02×00</text>
      <text x="306" y="76" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#2e2e28">05×00</text>
      <text x="456" y="76" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#2e2e28">07×00</text>

      {/* Status indicator */}
      <rect x="340" y="55" width="88" height="18" rx="1" fill="#1a1a16" stroke="#2e2e28" strokeWidth="0.5"/>
      <circle cx="351" cy="64" r="3" fill="#b8ff00"/>
      <text x="360" y="68" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#b8ff00">SYN.ACTIVE</text>

      {/* Secondary trace — dim */}
      <polyline
        points="150,20 150,80 300,80 300,320 450,320 450,380"
        stroke="#2e2e28"
        strokeWidth="1"
        strokeDasharray="4 4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Corner bracket — top left */}
      <path d="M30,40 L30,20 L70,20" stroke="#b8ff00" strokeWidth="1" fill="none"/>
      {/* Corner bracket — bottom right */}
      <path d="M570,360 L570,380 L530,380" stroke="#b8ff00" strokeWidth="1" fill="none"/>
    </svg>
  );
}
