import styles from '@/app/login/login.module.css';
import { TelemetryTiles } from './telemetry-tiles';

export function VisualScene() {
  return (
    <section className={styles.scene}>
      <div className={styles.sceneHeader}>
        <div className={styles.badge}>
          <span className={styles.dot} /> Centro de Operaciones · Acceso restringido
        </div>
        <h1 className={styles.heroTitle}>
          Centro de comando para <em>incendios</em> en tiempo real.
        </h1>
        <p className={styles.heroSub}>
          Datos satelitales de NASA FIRMS, análisis con agentes de IA sobre zonas críticas, cálculo de rutas de evacuación y alertas SMS dirigidas a tu ciudad. Una vista, un planeta, una respuesta temprana.
        </p>
        <div className={styles.statusRow}>
          <span className={styles.pill}><span className={styles.dot} /> NASA FIRMS · Conectado</span>
          <span className={styles.pill}><span className={styles.dotCyan} /> Monitoreo global activo</span>
          <span className={styles.pill}><span className={styles.dot} /> Alertas SMS listas</span>
          <span className={styles.pill}><span className={styles.dotOrange} /> IA operacional</span>
        </div>
      </div>

      {/* GLOBE */}
      <div className={styles.globeWrap} aria-hidden="true">
        <div className={styles.scanRingOuter} />
        <div className={styles.scanRing} />
        <div className={styles.globe}>
          <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="atm" cx="50%" cy="50%" r="50%">
                <stop offset="80%" stopColor="rgba(56,189,248,0)"/>
                <stop offset="100%" stopColor="rgba(56,189,248,0.45)"/>
              </radialGradient>
              <linearGradient id="link" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(56,189,248,.0)"/>
                <stop offset="60%" stopColor="rgba(56,189,248,.6)"/>
                <stop offset="100%" stopColor="rgba(56,189,248,.0)"/>
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="url(#atm)"/>
            {/* parallels */}
            <g fill="none" stroke="rgba(148,163,184,.18)" strokeWidth=".4">
              <ellipse cx="100" cy="100" rx="95" ry="10"/>
              <ellipse cx="100" cy="100" rx="92" ry="28"/>
              <ellipse cx="100" cy="100" rx="86" ry="48"/>
              <ellipse cx="100" cy="100" rx="78" ry="68"/>
              <ellipse cx="100" cy="100" rx="68" ry="84"/>
              <ellipse cx="100" cy="100" rx="55" ry="92"/>
            </g>
            {/* meridians */}
            <g fill="none" stroke="rgba(148,163,184,.16)" strokeWidth=".4">
              <ellipse cx="100" cy="100" rx="10" ry="95"/>
              <ellipse cx="100" cy="100" rx="28" ry="92"/>
              <ellipse cx="100" cy="100" rx="48" ry="86"/>
              <ellipse cx="100" cy="100" rx="68" ry="78"/>
              <ellipse cx="100" cy="100" rx="84" ry="68"/>
            </g>
            {/* continent-suggesting blobs */}
            <g fill="rgba(47,143,123,.28)" stroke="rgba(54,211,153,.35)" strokeWidth=".4">
              <path d="M62 70 Q70 60 82 65 Q90 70 86 80 Q92 90 84 100 Q72 104 66 96 Q58 88 62 78 Z"/>
              <path d="M108 62 Q126 58 134 70 Q140 80 132 90 Q140 100 130 110 Q118 112 112 102 Q108 92 114 84 Q104 76 108 62 Z"/>
              <path d="M70 118 Q86 116 92 128 Q98 142 88 152 Q76 156 70 146 Q62 136 70 118 Z"/>
              <path d="M122 124 Q138 122 144 134 Q150 146 140 154 Q128 156 122 146 Q116 134 122 124 Z"/>
            </g>
            {/* scan link lines */}
            <g stroke="url(#link)" strokeWidth=".6" fill="none">
              <line x1="100" y1="100" x2="160" y2="56">
                <animate attributeName="opacity" values="0;1;0" dur="3.5s" repeatCount="indefinite"/>
              </line>
              <line x1="100" y1="100" x2="48" y2="64">
                <animate attributeName="opacity" values="0;1;0" dur="4.2s" begin="-1s" repeatCount="indefinite"/>
              </line>
              <line x1="100" y1="100" x2="150" y2="150">
                <animate attributeName="opacity" values="0;1;0" dur="3s" begin="-2s" repeatCount="indefinite"/>
              </line>
              <line x1="100" y1="100" x2="56" y2="140">
                <animate attributeName="opacity" values="0;1;0" dur="3.8s" begin="-.6s" repeatCount="indefinite"/>
              </line>
            </g>
          </svg>
          <div className={styles.sweep} />
        </div>

        {/* fire foci */}
        <div className={styles.focusRed} style={{ top: '28%', left: '78%' }} />
        <div className={styles.focus} style={{ top: '24%', left: '24%' }} />
        <div className={styles.focusRed} style={{ top: '73%', left: '72%' }} />
        <div className={styles.focus} style={{ top: '64%', left: '30%' }} />
        <div className={styles.focus} style={{ top: '52%', left: '56%' }} />
        <div className={styles.focusRed} style={{ top: '40%', left: '40%', animationDelay: '-1s' }} />

        {/* corner labels */}
        <div style={{ position: 'absolute', top: '2%', left: '2%', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '.18em', color: 'var(--sentinel-text-3)', textTransform: 'uppercase' }}>LAT 32.4°S</div>
        <div style={{ position: 'absolute', top: '2%', right: '2%', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '.18em', color: 'var(--sentinel-text-3)', textTransform: 'uppercase', textAlign: 'right' }}>LON 70.6°W</div>
        <div style={{ position: 'absolute', bottom: '2%', left: '2%', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '.18em', color: 'var(--sentinel-text-3)', textTransform: 'uppercase' }}>VIIRS · MODIS · LANDSAT</div>
        <div style={{ position: 'absolute', bottom: '2%', right: '2%', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '.18em', color: 'var(--sentinel-text-3)', textTransform: 'uppercase', textAlign: 'right' }}>ÓRBITA · 14:32:08 UTC</div>
      </div>

      <TelemetryTiles />
    </section>
  );
}
