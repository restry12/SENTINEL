"use client"

import { Wind, Droplets, Thermometer, Eye } from "lucide-react"
import { bearingName, type EnvData } from "./types"
import { useLang } from "@/contexts/language-context"

interface Props { env: EnvData }

export function EnvStatus({ env }: Props) {
  const { tx } = useLang()
  const windDir  = bearingName(env.wind.fromDeg)
  const highWind = env.wind.speed > 40
  const lowHumid = env.humidity < 15
  const highTemp = env.tempC > 35
  const lowVis   = env.visibilityKm < 1.5

  const chips = [
    {
      Icon:  Wind,
      label: tx.wind,
      value: `${env.wind.speed} km/h ${windDir}`,
      alert: highWind,
      color: highWind ? "#ef4444" : undefined,
    },
    {
      Icon:  Droplets,
      label: tx.humidity,
      value: `${env.humidity}%`,
      alert: lowHumid,
      color: lowHumid ? "#f97316" : undefined,
    },
    {
      Icon:  Thermometer,
      label: tx.temperature,
      value: `${env.tempC}°C`,
      alert: highTemp,
      color: highTemp ? "#f97316" : undefined,
    },
    {
      Icon:  Eye,
      label: tx.visibility,
      value: `${env.visibilityKm} km`,
      alert: lowVis,
      color: lowVis ? "#ef4444" : undefined,
    },
  ]

  return (
    <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-1 font-mono">
      <div className="flex gap-2">
        {chips.map(chip => (
          <div
            key={chip.label}
            className="flex flex-col gap-1 px-3 py-2 bg-black/80 backdrop-blur-md border rounded-sm transition-all duration-500"
            style={{
              borderColor: chip.alert ? `${chip.color}60` : "rgba(255,255,255,0.1)",
              boxShadow:   chip.alert ? `0 0 8px ${chip.color}25` : "none",
            }}
          >
            <div className="flex items-center gap-1.5">
              <chip.Icon
                className="h-3 w-3 flex-shrink-0"
                style={{ color: chip.alert ? chip.color : "var(--muted-foreground)" }}
              />
              <span className="text-[9px] tracking-widest text-muted-foreground">{chip.label}</span>
              {chip.alert && (
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: chip.color,
                    animation:       "smokeAlertBlink 1s ease-in-out infinite",
                  }}
                />
              )}
            </div>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: chip.alert ? chip.color : "rgba(232,230,224,0.8)" }}
            >
              {chip.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
