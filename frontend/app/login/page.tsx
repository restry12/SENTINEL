import { Flame } from 'lucide-react'
import { Background } from '@/components/login/background'
import { VisualScene } from '@/components/login/visual-scene'
import { AuthCard } from '@/components/login/auth-card'
import { LanguageProvider } from '@/lib/i18n/language-context'
import { HeaderStatus } from '@/components/login/header-status'

export default function LoginPage() {
  return (
    <LanguageProvider>
      <main className="relative h-screen bg-background text-foreground overflow-hidden selection:bg-orange/30">
        <Background />

        <div className="fixed top-0 left-0 right-0 h-[1px] bg-[linear-gradient(90deg,transparent_0%,rgba(249,115,22,0.5)_50%,transparent_100%)] z-40" />

        <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4 font-mono text-[10px] tracking-[0.16em] text-text-muted uppercase border-b border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_70%)] bg-[#0a0b0e/85] backdrop-blur-[12px]">
          <div className="flex items-center gap-4">
            <div className="w-[30px] h-[30px] rounded-sm border border-border-2 bg-[radial-gradient(circle_at_50%_75%,rgba(249,115,22,0.32),transparent_65%),linear-gradient(180deg,#15171c,#0c0e12)] flex items-center justify-center">
              <Flame className="w-[16px] h-[18px] text-orange" />
            </div>
            <div className="flex flex-col gap-1 leading-none">
              <span className="text-sm font-semibold tracking-[0.18em] text-[#f4f5f7]">SENTINEL</span>
              <span className="text-[8px] tracking-[0.2em] text-text-dim lowercase font-sans">Wildfire Intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-8">
              <HeaderStatus />
            </div>
          </div>
        </header>

        <div className="relative z-10 pt-[60px] pb-[44px] h-full grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
          <div className="hidden lg:block">
            <VisualScene />
          </div>
          <section className="flex flex-col justify-center items-center p-5 sm:p-8 lg:p-10 overflow-y-auto">
            <AuthCard />
          </section>
        </div>

        <footer className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 font-mono text-[9px] tracking-[0.2em] text-text-muted uppercase border-t border-border bg-[#0a0b0e/85] backdrop-blur-[8px]">
          <div className="hidden md:block italic text-text-dim">ORBITAL MONITORING STATION · LATENCY: 24MS · SECURE CHANNEL</div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-green-soft font-bold">OPERATIONAL</span>
            </div>
            <span className="hidden sm:block">© SENTINEL INTELLIGENCE</span>
          </div>
        </footer>
      </main>
    </LanguageProvider>
  )
}
