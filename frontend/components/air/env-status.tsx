"use client"

import { Wind, Droplets, Thermometer, Eye } from "lucide-react"
import type { EnvData } from "./types"

interface Props { env: EnvData }

const BEARING_NAMES = ["N","NE","E","SE","S","SW","W","NW"]
function bearingName(deg: number): string {
  return BEARING_NAMES[Math.round(deg / 45) % 8]
}

export function EnvStatus({ env }: Props) {
  const windDir = bearingName(env.wind.fromDeg)

  const chips = [
    { Icon: Wind,        value: `${env.wind.speed} km/h ${windDir}` },
    { Icon: Droplets,    value: `${env.humidity}%` },
    { Icon: Thermometer, value: `${env.tempC}°C` },
    { Icon: Eye,         value: `${env.visibilityKm} km` },
  ]

  return (
    <div className="absolute bottom-4 left-4 z-[1000] flex gap-2 font-mono">
      {chips.map(({ Icon, value }) => (
        <div
          key={value}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/75 backdrop-blur-md border border-white/10 rounded-sm"
        >
          <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-foreground/80">{value}</span>
        </div>
      ))}
    </div>
  )
}
