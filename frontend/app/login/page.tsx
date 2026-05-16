import { Background } from '@/components/login/background';
import { VisualScene } from '@/components/login/visual-scene';
import { AuthCard } from '@/components/login/auth-card';
import styles from './login.module.css';

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-sentinel-bg-0 text-sentinel-text-0 overflow-hidden selection:bg-sentinel-cyan/30">
      <Background />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 md:px-7 py-3 md:py-4.5 font-mono text-[10px] md:text-[11px] tracking-[0.16em] text-sentinel-text-2 uppercase border-b border-sentinel-line bg-gradient-to-b from-sentinel-bg-0/85 to-transparent backdrop-blur-[6px]">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 md:w-6.5 md:h-6.5 text-sentinel-text-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 11l5-5 4 4-5 5-4-4zM13 12l4 4-5 5-4-4 5-5zM12 7l5 5M7 12l5 5" />
            <circle cx="18.5" cy="5.5" r="1.2" fill="currentColor" stroke="none"/>
          </svg>
          <div className="flex items-baseline gap-2 md:gap-2.5">
            <div className="font-serif text-lg md:text-[22px] tracking-[0.12em] text-sentinel-text-0 leading-none">SENTINEL</div>
            <div className="text-sentinel-text-3 text-[8px] md:text-[10px] tracking-[0.22em] hidden xs:block">v2.4 · Global Wildfire Watch</div>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-6.5">
          <span className="flex items-center gap-2"><span className={styles.dot} /> NASA FIRMS · LINK</span>
          <span className="flex items-center gap-2"><span className={styles.dotCyan} /> 04 SATÉLITES</span>
          <span className="flex items-center gap-2"><span className={styles.dotOrange} /> 312 FOCOS · 24H</span>
          <span className="text-sentinel-text-3">UTC <strong className="text-sentinel-text-1 font-medium tracking-[0.18em] ml-1">12:34:56</strong></span>
        </div>
        <div className="lg:hidden flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className={styles.dot} /> FIRMS</span>
          <span className="text-sentinel-text-3 font-medium">12:34:56</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 pt-[60px] pb-[44px] grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] min-h-screen">
        <VisualScene />
        <section className="flex flex-col justify-center items-center p-6 md:p-10 lg:p-14 min-h-[calc(100vh-104px)]">
          <AuthCard />
        </section>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 md:px-7 py-3 md:py-4.5 font-mono text-[10px] md:text-[11px] tracking-[0.16em] text-sentinel-text-2 uppercase border-t border-sentinel-line bg-gradient-to-t from-sentinel-bg-0/85 to-transparent backdrop-blur-[6px]">
        <div className="hidden md:block">Sistema de monitoreo global · Datos satelitales · Alertas críticas</div>
        <div className="md:hidden">Sentinel v2.4 · Monitoreo Global</div>
        <div className="flex items-center gap-4 md:gap-5.5">
          <span className="hidden xs:block">SLA 99.97%</span>
          <span className="flex items-center gap-2"><span className={styles.dot} /> Operacional</span>
          <span className="hidden sm:block">© SENTINEL · Santiago · Chile</span>
        </div>
      </footer>
    </main>
  );
}
