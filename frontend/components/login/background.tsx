'use client';

import { useEffect, useRef } from 'react';
import styles from '@/app/login/login.module.css';

function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Generate stars
    const STAR_COUNT = 320;
    type Star = { x: number; y: number; r: number; base: number; phase: number; speed: number };
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x:     Math.random(),
      y:     Math.random(),
      r:     Math.random() * 1.1 + 0.2,
      base:  Math.random() * 0.55 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.6 + 0.3,
    }));

    // Star colors — mostly white/blue-white, few warm
    const colors = ['#cfe2ff', '#ffffff', '#d6e8ff', '#b9d4ff', '#ffe7c7', '#e8f0ff'];

    let raf: number;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        const opacity = s.base + Math.sin(t * 0.001 * s.speed + s.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = colors[Math.floor(s.r * 3) % colors.length];
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    />
  );
}

export function Background() {
  return (
    <>
      <StarfieldCanvas />
      <div className={styles.gridOverlay} aria-hidden="true" />
      <div className={styles.scanOverlay} aria-hidden="true" />
      <div className={styles.vignette}    aria-hidden="true" />
    </>
  );
}
