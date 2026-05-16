import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Incident {
  id: string
  lat: number
  lng: number
  intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  type: string
  created_at: string
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data } = await supabase.from('incidents').select('*')
      if (data) setIncidents(data)
    }

    fetchIncidents()

    const channel = supabase
      .channel('incidents_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, fetchIncidents)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return incidents
}
