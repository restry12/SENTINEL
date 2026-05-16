'use client';

import { useEffect, useRef } from 'react';
import styles from '@/app/login/login.module.css';
import { TelemetryTiles } from './telemetry-tiles';
import { ShieldAlert, Activity, Globe } from 'lucide-react';

const EARTH_URL = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';

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
        x: ((e.clientY - cy) / cy) * -10,
        y: ((e.clientX - cx) / cx) * 10,
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
      {/* Header */}
      <div className={styles.sceneHeader}>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full border border-red/35 bg-[linear-gradient(180deg,rgba(255,51,51,0.15),rgba(255,51,51,0.05))] text-red flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase whitespace-nowrap">Restricted Access</span>
          </div>
        </div>

        <h1 className="text-[clamp(26px,2.8vw,48px)] font-black leading-[1.05] tracking-tight text-white uppercase">
          Command Center for{' '}
          <span className="text-orange drop-shadow-[0_0_15px_rgba(255,126,21,0.4)]">Real-Time</span>{' '}
          Fire Intelligence.
        </h1>

        <p className="max-w-[500px] text-[13px] leading-relaxed text-text-dim hidden xl:block">
          Harnessing NASA FIRMS telemetry, AI-driven analysis, and autonomous evacuation routing.
        </p>

        <div className="flex flex-wrap gap-2">
          {[
            { icon: <Activity className="w-3 h-3" />, text: 'NASA FIRMS LIVE', color: 'text-orange' },
            { icon: <Globe className="w-3 h-3" />, text: 'GLOBAL WATCH ACTIVE', color: 'text-blue' },
            { icon: <ShieldAlert className="w-3 h-3" />, text: 'SMS ALERTS READY', color: 'text-red' },
          ].map((item, i) => (
            <span
              key={i}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg border border-white/5 bg-surface/50 text-[10px] font-bold tracking-widest ${item.color} backdrop-blur-md`}
            >
              {item.icon} {item.text}
            </span>
          ))}
        </div>
      </div>

      {/* Globe */}
      <div className={styles.globeArea} style={{ perspective: '900px' }}>
        <div
          ref={globeRef}
          className={styles.globeWrap}
          aria-hidden="true"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          {/* Atmosphere glow */}
          <div className={styles.atmosphere} />

          {/* Orbit rings */}
          <div className={styles.scanRingOuter} />
          <div className={styles.scanRing} />

          {/* Globe surface */}
          <div className={styles.globe}>
            {/* Rotating Earth texture */}
            <div
              className={styles.earthTexture}
              style={{ backgroundImage: `url(${EARTH_URL})` }}
            />
            {/* Sphere shading */}
            <div className={styles.sphereShading} />
            {/* Radar sweep */}
            <div className={styles.sweep} />
          </div>

          {/* Fire markers */}
          <div className="absolute top-[28%] left-[78%] w-2.5 h-2.5 bg-red rounded-full shadow-[0_0_14px_var(--red)] animate-pulse" />
          <div className="absolute top-[24%] left-[24%] w-2   h-2   bg-orange rounded-full shadow-[0_0_12px_var(--orange)] animate-pulse" />
          <div className="absolute top-[73%] left-[72%] w-2.5 h-2.5 bg-red rounded-full shadow-[0_0_14px_var(--red)] animate-pulse" />
          <div className="absolute top-[52%] left-[56%] w-2   h-2   bg-orange rounded-full shadow-[0_0_12px_var(--orange)] animate-pulse" />

          {/* Corner labels */}
          <div className="absolute top-0 left-0   p-2 font-mono text-[9px] font-black tracking-widest text-blue uppercase opacity-70">LAT 32.4°S</div>
          <div className="absolute top-0 right-0  p-2 font-mono text-[9px] font-black tracking-widest text-blue uppercase opacity-70">LON 70.6°W</div>
          <div className="absolute bottom-0 left-0  p-2 font-mono text-[9px] font-black tracking-widest text-text-muted uppercase opacity-70">SATELLITE DOWNLINK · SECURE</div>
          <div className="absolute bottom-0 right-0 p-2 font-mono text-[9px] font-black tracking-widest text-green-soft uppercase opacity-70 animate-pulse">ENCRYPTED</div>
        </div>
      </div>

      <TelemetryTiles />
    </section>
  );
}
