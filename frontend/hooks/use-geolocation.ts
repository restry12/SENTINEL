"use client"

import { useEffect, useState } from "react"

export interface GeoCoords {
  lat: number
  lon: number
}

// Requests the device GPS location once on mount. Returns null until the user
// grants permission; stays null if permission is denied or GPS is unavailable.
export function useGeolocation(): GeoCoords | null {
  const [coords, setCoords] = useState<GeoCoords | null>(null)

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        /* permission denied / unavailable — no marker shown */
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }, [])

  return coords
}
