"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

export type CondorState = 'entry' | 'landing' | 'speaking' | 'idle'

interface Props {
  state: CondorState
}

export function CondorGuideAvatar({ state }: Props) {
  const speaking = state === 'speaking'
  const active = state === 'idle' || state === 'speaking'

  const rootAnim = cn(
    state === 'entry'   && 'condor-fly-in',
    state === 'landing' && 'condor-land',
    state === 'speaking' && 'condor-speak',
    state === 'idle'    && 'condor-float',
  )

  return (
    <div className={cn("relative w-full h-full", rootAnim)}>

      {/* Outer breathe glow — cyan */}
      <div className={cn(
        "absolute inset-0 rounded-full pointer-events-none condor-breathe",
        "scale-[2.4] blur-2xl",
        speaking ? "bg-cyan-500/[0.18]" : "bg-cyan-500/[0.08]",
      )} style={{ transition: 'background-color 0.8s' }} />

      {/* Secondary orange glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none condor-breathe bg-orange-500/[0.07] scale-[1.7] blur-xl [animation-delay:2.1s]"
      />

      {/* Radar ring — clockwise */}
      <div className={cn(
        "absolute inset-0 rounded-full border border-dashed pointer-events-none condor-radar transition-all duration-700",
        active ? "opacity-100" : "opacity-0",
        speaking ? "border-cyan-400/25 scale-[2.0]" : "border-cyan-400/12 scale-[1.8]",
      )} />

      {/* Radar ring — counter-clockwise, orange accent */}
      <div className={cn(
        "absolute inset-0 rounded-full border pointer-events-none condor-radar-rev transition-opacity duration-700",
        active ? "opacity-100" : "opacity-0",
        "border-orange-500/[0.09] scale-[1.55]",
      )} />

      {/* Voice ripple rings — speaking only */}
      {speaking && (
        <>
          <div className="absolute inset-0 rounded-full border border-cyan-400/40 pointer-events-none condor-voice-1" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/25 pointer-events-none condor-voice-2" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/14 pointer-events-none condor-voice-3" />
        </>
      )}

      {/* Avatar circle */}
      <div className={cn(
        "relative w-full h-full rounded-full overflow-hidden border",
        "transition-shadow duration-700",
        speaking
          ? "border-cyan-400/55 shadow-[0_0_55px_rgba(34,211,238,0.32),0_0_22px_rgba(34,211,238,0.18),inset_0_0_22px_rgba(34,211,238,0.07)]"
          : "border-cyan-500/25 shadow-[0_0_22px_rgba(34,211,238,0.11),inset_0_0_10px_rgba(34,211,238,0.03)]",
      )}>
        {/* Spinning border — orange */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent z-10 pointer-events-none transition-[border-color] duration-700"
          style={{
            borderTopColor: speaking ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.22)',
            animation: 'spin 7s linear infinite',
          }}
        />
        {/* Spinning border — cyan, reverse */}
        <div
          className="absolute inset-[3px] rounded-full border border-transparent z-10 pointer-events-none transition-[border-color] duration-700"
          style={{
            borderTopColor: speaking ? 'rgba(34,211,238,0.52)' : 'rgba(34,211,238,0.16)',
            animation: 'spin 12s linear infinite reverse',
          }}
        />

        <Image
          src="/condor.png"
          alt="Cóndi — SENTINEL AI"
          fill
          className={cn(
            "object-cover object-top z-0 transition-all duration-700",
            speaking && "brightness-[1.12] saturate-[1.08]"
          )}
          priority
        />
      </div>
    </div>
  )
}
