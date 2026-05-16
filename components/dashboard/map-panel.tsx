"use client"

const hotspots = [
  { id: 1, x: 35, y: 30, size: 24, intensity: "high" },
  { id: 2, x: 55, y: 45, size: 32, intensity: "critical" },
  { id: 3, x: 70, y: 60, size: 18, intensity: "medium" },
]

const fireSpreadPolygon = "M 45,25 L 65,30 L 75,50 L 70,70 L 50,65 L 40,45 Z"
const evacuationRoute = "M 20,85 Q 30,70 45,65 T 70,50 T 85,25"

export function MapPanel() {
  return (
    <div className="h-[40vh] md:h-auto md:flex-1 flex flex-col bg-background border-b md:border-b-0 border-border shrink-0">
      {/* Map Header */}
      <div className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Map
          </h2>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">34.05°N</span>
            <span className="text-border">|</span>
            <span className="font-mono">118.24°W</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 rounded-full bg-warning pulse-dot" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Fire</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 border border-dashed border-warning rounded-sm" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Spread</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-0.5 w-3 md:w-4 bg-safe" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Evac</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Grid Background */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#1f1f1f"
                strokeWidth="0.5"
              />
            </pattern>
            <pattern
              id="grid-large"
              width="200"
              height="200"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 200 0 L 0 0 0 200"
                fill="none"
                stroke="#2a2a2a"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <rect width="100%" height="100%" fill="url(#grid-large)" />
        </svg>

        {/* Map Content */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Fire Spread Projection Polygon */}
          <path
            d={fireSpreadPolygon}
            fill="none"
            stroke="#f97316"
            strokeWidth="0.3"
            strokeDasharray="1,0.5"
            opacity="0.6"
          />
          <path d={fireSpreadPolygon} fill="#f97316" opacity="0.1" />

          {/* Safe Evacuation Route */}
          <path
            d={evacuationRoute}
            fill="none"
            stroke="#22c55e"
            strokeWidth="0.4"
            strokeLinecap="round"
          />
          <circle cx="20" cy="85" r="1" fill="#22c55e" />
          <circle cx="85" cy="25" r="1.5" fill="#22c55e" />
          <text
            x="87"
            y="24"
            fontSize="3"
            fill="#22c55e"
            className="font-mono"
          >
            SAFE
          </text>

          {/* Fire Hotspots with Pulsing Animation */}
          {hotspots.map((spot) => (
            <g key={spot.id}>
              <circle
                cx={spot.x}
                cy={spot.y}
                r={spot.size / 8}
                fill="none"
                stroke="#f97316"
                strokeWidth="0.2"
                opacity="0.4"
                className="pulse-ring"
              />
              <circle
                cx={spot.x}
                cy={spot.y}
                r={spot.size / 8}
                fill="none"
                stroke="#f97316"
                strokeWidth="0.2"
                opacity="0.3"
                className="pulse-ring"
                style={{ animationDelay: "0.5s" }}
              />
              <circle
                cx={spot.x}
                cy={spot.y}
                r={spot.size / 12}
                fill="#f97316"
                className="pulse-dot"
              />
              <circle
                cx={spot.x}
                cy={spot.y}
                r={spot.size / 20}
                fill="#fbbf24"
              />
            </g>
          ))}
        </svg>

        {/* Map Labels */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4">
          <div className="px-2 py-1 bg-card/80 border border-border rounded text-xs font-mono text-muted-foreground">
            SECTOR 7A
          </div>
        </div>

        <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4">
          <div className="px-2 py-1 md:px-3 md:py-2 bg-card/90 border border-border rounded">
            <div className="flex items-center gap-2">
              <div className="w-8 md:w-16 h-0.5 bg-foreground" />
              <span className="text-xs font-mono text-foreground">5 km</span>
            </div>
          </div>
        </div>

        {/* Hotspot Labels - Hidden on mobile for cleaner look */}
        <div
          className="hidden md:block absolute text-xs font-mono text-warning bg-card/80 px-2 py-1 rounded border border-warning/30"
          style={{ top: "25%", left: "38%" }}
        >
          FIRE-001
        </div>
        <div
          className="hidden md:block absolute text-xs font-mono text-critical bg-card/80 px-2 py-1 rounded border border-critical/30"
          style={{ top: "40%", left: "58%" }}
        >
          FIRE-002 (PRIMARY)
        </div>
        <div
          className="hidden md:block absolute text-xs font-mono text-warning bg-card/80 px-2 py-1 rounded border border-warning/30"
          style={{ top: "58%", left: "72%" }}
        >
          FIRE-003
        </div>
      </div>
    </div>
  )
}
