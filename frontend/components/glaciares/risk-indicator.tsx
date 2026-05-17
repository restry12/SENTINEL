"use client"

import React from "react"

interface RiskIndicatorProps {
  value: number // 0-100
  label?: string
}

export function RiskIndicator({ value, label }: RiskIndicatorProps) {
  // Determine color based on value
  const getColor = (val: number) => {
    if (val < 25) return "#3b82f6" // Blue
    if (val < 50) return "#10b981" // Green
    if (val < 75) return "#f59e0b" // Orange
    return "#ef4444" // Red
  }

  const color = getColor(value)

  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-between items-end">
        {label && (
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {label}
          </span>
        )}
        <span className="text-[11px] font-mono font-black" style={{ color }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full transition-all duration-1000 ease-out rounded-full"
          style={{
            width: `${value}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
    </div>
  )
}
