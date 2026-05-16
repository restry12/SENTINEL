'use client';

import { useEffect, useRef } from 'react';
import styles from '@/app/login/login.module.css';
import { TelemetryTiles } from './telemetry-tiles';
import { ShieldAlert, Activity, Globe } from 'lucide-react';

export function VisualScene() {
  const globeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetRef.current = {
        x: ((e.clientY - cy) / cy) * -12,
        y: ((e.clientX - cx) / cx) * 12,
      };
    };

    const tick = () => {
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.x - c.x) * 0.06;
      c.y += (t.y - c.y) * 0.06;
      if (globeRef.current) {
        globeRef.current.style.transform = `rotateX(${c.x}deg) rotateY(${c.y}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section className={styles.scene}>
      <div className={styles.sceneHeader}>
        <div className="flex items-center gap-3 mb-6">
          <div className="px-3.5 py-1.5 rounded-full border border-red/35 bg-[linear-gradient(180deg,rgba(255,51,51,0.15),rgba(255,51,51,0.05))] text-red flex items-center gap-2.5 shadow-[0_10px_30px_-10px_rgba(255,51,51,0.3)]">
            <div className="w-1.5 h-1.5 rounded-full bg-red shadow-[0_0_8px_var(--red)] animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase whitespace-nowrap">Restricted Access</span>
          </div>
        </div>

        <h1 className="text-[clamp(40px,4.6vw,72px)] font-black leading-[1.05] tracking-tight text-white mb-6 uppercase">
          Command Center for <span className="text-orange drop-shadow-[0_0_15px_rgba(255,126,21,0.4)]">Real-Time</span> Fire Intelligence.
        </h1>

        <p className="max-w-[520px] text-[15px] font-medium leading-relaxed text-text-dim mb-8">
          Harnessing NASA FIRMS telemetry, AI-driven critical analysis, and autonomous evacuation routing. One planet, one station, immediate response.
        </p>

        <div className="flex flex-wrap gap-3">
          {[
            { icon: <Activity className="w-3 h-3" />, text: "NASA FIRMS LIVE", color: "text-orange" },
            { icon: <Globe className="w-3 h-3" />, text: "GLOBAL WATCH ACTIVE", color: "text-blue" },
            { icon: <ShieldAlert className="w-3 h-3" />, text: "SMS ALERTS READY", color: "text-red" },
          ].map((item, i) => (
            <span key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-surface/50 text-[10px] font-bold tracking-widest ${item.color} backdrop-blur-md`}>
              {item.icon} {item.text}
            </span>
          ))}
        </div>
      </div>

      {/* GLOBE — perspective wrapper keeps 3D tilt contained */}
      <div style={{ perspective: '900px', perspectiveOrigin: '50% 50%' }}>
        <div ref={globeRef} className={styles.globeWrap} aria-hidden="true" style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
          <div className="absolute inset-0 map-aura opacity-50" />
          <div className={styles.scanRingOuter} />
          <div className={styles.scanRing} />
          <div className={styles.globe}>
            <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
              <defs>
                <radialGradient id="atm" cx="50%" cy="50%" r="50%">
                  <stop offset="75%" stopColor="rgba(56,189,248,0)"/>
                  <stop offset="92%" stopColor="rgba(56,189,248,0.2)"/>
                  <stop offset="100%" stopColor="rgba(56,189,248,0.45)"/>
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="98" fill="url(#atm)"/>
              {/* parallels */}
              <g fill="none" stroke="rgba(56,189,248,.25)" strokeWidth=".4">
                <ellipse cx="100" cy="100" rx="95" ry="10"/>
                <ellipse cx="100" cy="100" rx="92" ry="28"/>
                <ellipse cx="100" cy="100" rx="86" ry="48"/>
                <ellipse cx="100" cy="100" rx="78" ry="68"/>
                <ellipse cx="100" cy="100" rx="68" ry="84"/>
                <ellipse cx="100" cy="100" rx="55" ry="92"/>
              </g>
              {/* meridians */}
              <g fill="none" stroke="rgba(56,189,248,.18)" strokeWidth=".4">
                <line x1="100" y1="5" x2="100" y2="195"/>
                <ellipse cx="100" cy="100" rx="48" ry="95"/>
                <ellipse cx="100" cy="100" rx="84" ry="95"/>
              </g>
              {/* continent blobs */}
              <g fill="rgba(16,185,129,.35)" stroke="rgba(52,211,153,.4)" strokeWidth=".4">
                <path d="M62 70 Q70 60 82 65 Q90 70 86 80 Q92 90 84 100 Q72 104 66 96 Q58 88 62 78 Z"/>
                <path d="M108 62 Q126 58 134 70 Q140 80 132 90 Q140 100 130 110 Q118 112 112 102 Q108 92 114 84 Q104 76 108 62 Z"/>
                <path d="M70 118 Q86 116 92 128 Q98 142 88 152 Q76 156 70 146 Q62 136 70 118 Z"/>
                <path d="M122 124 Q138 122 144 134 Q150 146 140 154 Q128 156 122 146 Q116 134 122 124 Z"/>
              </g>
            </svg>
            <div className={styles.sweep} />
          </div>

          {/* fire foci */}
          <div className="absolute top-[28%] left-[78%] w-2.5 h-2.5 bg-red rounded-full shadow-[0_0_15px_var(--red)] animate-pulse" />
          <div className="absolute top-[24%] left-[24%] w-2 h-2 bg-orange rounded-full shadow-[0_0_12px_var(--orange)] animate-pulse" />
          <div className="absolute top-[73%] left-[72%] w-2.5 h-2.5 bg-red rounded-full shadow-[0_0_15px_var(--red)] animate-pulse" />
          <div className="absolute top-[52%] left-[56%] w-2 h-2 bg-orange rounded-full shadow-[0_0_12px_var(--orange)] animate-pulse" />

          {/* corner labels */}
          <div className="absolute top-0 left-0 p-2 font-mono text-[9px] font-black tracking-widest text-blue uppercase opacity-70">LAT 32.4°S</div>
          <div className="absolute top-0 right-0 p-2 font-mono text-[9px] font-black tracking-widest text-blue uppercase opacity-70">LON 70.6°W</div>
          <div className="absolute bottom-0 left-0 p-2 font-mono text-[9px] font-black tracking-widest text-text-muted uppercase opacity-70">SATELLITE DOWNLINK · SECURE</div>
          <div className="absolute bottom-0 right-0 p-2 font-mono text-[9px] font-black tracking-widest text-green-soft uppercase opacity-70 animate-pulse">ENCRYPTED</div>
        </div>
      </div>

      <TelemetryTiles />
    </section>
  );
}
