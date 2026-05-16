'use client';

import { useEffect, useRef } from 'react';
import styles from '@/app/login/login.module.css';
import { TelemetryTiles } from './telemetry-tiles';
import { GlobeCanvas } from './globe-canvas';
import { ShieldAlert, Activity, Globe } from 'lucide-react';

export function VisualScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const mouse      = useRef({ x: 0, y: 0 });
  const current    = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = {
        x: (e.clientX / window.innerWidth  - 0.5) * 24,
        y: (e.clientY / window.innerHeight - 0.5) * 14,
      };
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      current.current.x += (mouse.current.x - current.current.x) * 0.06;
      current.current.y += (mouse.current.y - current.current.y) * 0.06;
      if (sectionRef.current) {
        sectionRef.current.style.transform =
          `translate(${current.current.x}px, ${current.current.y}px)`;
      }
    };
    tick();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section ref={sectionRef} className={styles.scene}>
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
            { icon: <Activity className="w-3 h-3" />, text: 'NASA FIRMS LIVE',    color: 'text-orange' },
            { icon: <Globe    className="w-3 h-3" />, text: 'GLOBAL WATCH ACTIVE', color: 'text-blue'   },
            { icon: <ShieldAlert className="w-3 h-3" />, text: 'SMS ALERTS READY', color: 'text-red'    },
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
      <div className={styles.globeArea}>
        <div className={styles.globeWrap} aria-hidden="true">
          {/* Atmosphere glow */}
          <div className={styles.atmosphere} />

          {/* Orbit rings */}
          <div className={styles.scanRingOuter} />
          <div className={styles.scanRing} />

          {/* WebGL Earth */}
          <div className={styles.globe}>
            <GlobeCanvas />
            {/* Radar sweep on top of 3D globe */}
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
