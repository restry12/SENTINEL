"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type CondorState = 'entry' | 'landing' | 'speaking' | 'idle'

interface Props {
  state: CondorState
}

export function CondorGuideAvatar({ state }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasError, setHasError] = useState(false)

  const speaking = state === 'speaking'
  const active = state === 'idle' || state === 'speaking'

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (state === 'entry') {
      video.currentTime = 2.0
      video.play().catch(() => setHasError(true))
    } else if (state === 'landing') {
      if (video.currentTime < 5.0) {
        video.play()
      } else {
        video.currentTime = 5.0
        video.play()
      }
    } else if (state === 'idle' || state === 'speaking') {
      video.currentTime = 6.5
      video.loop = true
      video.play().catch(() => setHasError(true))
    }
  }, [state])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      if ((state === 'idle' || state === 'speaking') && video.currentTime >= 7.5) {
        video.currentTime = 6.5
      }
      if (state === 'entry' && video.currentTime >= 5.0) {
        video.pause()
      }
      if (state === 'landing' && video.currentTime >= 6.5) {
        video.currentTime = 6.5
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [state])

  return (
    <div className="relative w-full h-full">
      <div className={cn("relative w-full h-full transition-transform duration-1000")}>
        
        {/* Atmosphere / Glows (Cian for NEWEN AI) */}
        <div className={cn(
          "absolute inset-0 rounded-full pointer-events-none transition-all duration-1000",
          "scale-[1.8] blur-2xl opacity-30",
          active ? (speaking ? "bg-cyan-400/40" : "bg-cyan-500/15") : "bg-cyan-500/5",
        )} />

        {/* Avatar Container - Back to Circular with White Background */}
        <div className={cn(
          "relative w-full h-full rounded-full overflow-hidden border transition-all duration-700 bg-white",
          active 
            ? "border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.2)]" 
            : "border-white/10 shadow-none"
        )}>
          {/* Fallback Image */}
          {(hasError) ? (
            <img 
              src="/condor.png" 
              alt="Newen" 
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src="/condor-v2.mp4"
              className="w-full h-full object-contain scale-110"
              muted
              playsInline
              onError={() => setHasError(true)}
            />
          )}

          {/* Overlays for "Speaking" effect */}
          {speaking && (
            <div className="absolute inset-0 bg-cyan-400/5 mix-blend-overlay animate-pulse pointer-events-none" />
          )}
        </div>
        
        {/* Decorative Ring */}
        {active && (
          <div className="absolute inset-[-6px] rounded-full border border-cyan-500/10 animate-[spin_12s_linear_infinite]" />
        )}
      </div>
    </div>
  )
}
