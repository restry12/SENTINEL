'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'

export const t = {
  es: {
    // TopBar
    brandSub:        'Inteligencia de Incendios',
    statusCritical:  'Crítico Activo',
    hotspots:        'FOCOS',
    operational:     'OPERACIONAL',
    navDashboard:    'PANEL',
    navAir:          'CALIDAD AIRE',
    airMonitor:      'MONITOR CALIDAD AIRE',
    // Login
    welcome:         'Bienvenido a SENTINEL',
    loginSub:        'Ingrese sus credenciales para acceder al comando central de monitoreo.',
    emailLabel:      'Email de Operador',
    passwordLabel:   'Clave de Acceso',
    loginBtn:        'Iniciar Sesión',
    orQuick:         'O continúa sin cuenta',
    demoBtn:         'Ver Demo →',
    noAccount:       '¿No tiene una cuenta?',
    requestAccess:   'Solicite acceso aquí',
    hasAccount:      '¿Ya tiene una cuenta?',
    enter:           'Ingrese aquí',
    // Left Panel
    threatAssessment:  'Evaluación de Amenaza',
    currentRisk:       'Nivel de Riesgo Actual',
    immediateAction:   'Acción Inmediata Requerida · Sector 7A',
    fireRadiativePower:'Potencia Radiativa del Fuego',
    windConditions:    'Condiciones de Viento',
    airQualityIndex:   'Índice de Calidad del Aire',
    aqiUnhealthy:      'NO SALUDABLE',
    activeBroadcast:   'Transmisión Activa',
    wildfireAlert:     '⚠ ALERTA INCENDIO:',
    evacuationOrder:   'Evacuación inmediata ordenada para Zona 7A–C. Diríjase al refugio en Lincoln High School por Ruta 42.',
    recipients:        'Receptores',
    // Right Panel
    situationalIntel:  'Inteligencia Situacional',
    socialImpact:      'Impacto Social',
    populationAtRisk:  'Población en Riesgo',
    evacuated:         'Evacuados',
    inShelters:        'En Refugios',
    evacuationProgress:'Progreso de Evacuación',
    escapeRoutes:      'Rutas de Escape',
    routeActive:       'ACTIVA',
    estTravel:         'Tiempo Est.',
    hwyClosed:         'HWY 9 CERRADA · PELIGRO',
    officialBriefing:  'Informe Oficial',
    execSummary:       'Resumen Ejecutivo',
    containment:       'Contención al',
    windNote:          'Vientos NW empujando hacia sectores residenciales.',
    incidentCommander: 'Comandante de Incidente',
    // Metric Cards
    riskLevel:   'Nivel de Riesgo',
    airQuality:  'Calidad del Aire',
    wind:        'Viento',
    firePower:   'Potencia del Fuego',
    // Safe Route
    safeRoute:   'Ruta Segura',
    estTravelTime:'Tiempo est. de viaje',
    // Info Sections
    municipalBriefing: 'Informe Municipal',
    personnel:   'Personal',
    vehicles:    'Vehículos',
    aircraft:    'Aeronaves',
    nextBriefing:'Próximo informe: 18:00 UTC',
    atRisk:      'En Riesgo',
    structures:  'Estructuras',
    // Air — Smoke Alert
    smokePropagation:  'Propagación de Humo Detectada',
    activeSources:     'Fuentes Activas',
    windLabel:         'Viento:',
    // Air — Env Status
    humidity:    'HUMEDAD',
    temperature: 'TEMP',
    visibility:  'VISIBILIDAD',
    // Air — AQI Legend
    aqiScale:    'Escala AQI',
    // Air — Threat Indicator
    threatLow:      'AMENAZA: BAJA',
    threatModerate: 'AMENAZA: MODERADA',
    threatHigh:     'AMENAZA: ALTA',
    threatCritical: 'AMENAZA: CRÍTICA',
    // Air — Action Plan
    aiResponsePlan: 'PLAN DE RESPUESTA IA',
    generatedBy:    'Generado por SENTINEL IA ·',
    actions: {
      low:      ['Monitorear niveles de calidad del aire','Actividades normales permitidas','Mantener contactos de emergencia listos'],
      moderate: ['Grupos sensibles reducen tiempo al aire libre','Cerrar ventanas en zonas afectadas','Evitar ejercicio intenso al exterior'],
      high:     ['Alertar instalaciones de salud','Suspender actividades escolares al aire libre','Distribuir mascarillas N95 en zonas vulnerables','Evitar ejercicio al exterior — todos los grupos','Preparar equipos de respuesta de emergencia'],
      critical: ['INMEDIATO: Evacuar zonas afectadas','Suspender TODAS las actividades al exterior','Desplegar unidades médicas de emergencia','Activar centro de comando de incidentes','Emitir alerta de emergencia pública','Solicitar apoyo aéreo regional','Abrir refugios de emergencia'],
    },
    // Air — AI Briefing
    aiIntelligence: 'INTELIGENCIA IA',
    briefings: {
      low:      ['La calidad del aire permanece dentro de parámetros aceptables en todas las zonas monitoreadas.','La densidad de PM2.5 es mínima. No se detecta riesgo inmediato para la salud pública.','Las condiciones de viento son favorables. Las tasas de dispersión son adecuadas.'],
      moderate: ['Propagación de PM2.5 identificada, moviéndose hacia sectores residenciales a 24 km/h.','Los niveles AQI se acercan a umbrales preocupantes en los distritos del noroeste.','Las poblaciones sensibles deben comenzar medidas de precaución en interiores.'],
      high:     ['La densidad de PM2.5 aumenta hacia sectores poblados al noroeste de las fuentes de emisión.','El deterioro proyectado del AQI puede afectar a poblaciones vulnerables en 2 horas.','El viento a 315° está acelerando la deriva del humo hacia el corredor de Temuco.','Las instalaciones de salud en el radio afectado han sido puestas en alerta.'],
      critical: ['CRÍTICO: La concentración de PM2.5 ha superado los umbrales de exposición seguros.','Los equipos de respuesta de emergencia han sido activados en todas las zonas afectadas.','La población en el corredor de exposición primario debe buscar refugio de inmediato.','Se proyecta que la calidad del aire permanecerá crítica durante las próximas 4–6 horas.'],
    },
    // Air — Incident Timeline
    incidentLog: 'REGISTRO DE INCIDENTES',
    events: {
      base:     ['Fuente de contaminación detectada — AQI en aumento','Dispersión de PM2.5 identificada — sector NW','Umbral AQI superado — zona B crítica','Deterioro AQI proyectado — proyección 2h','Alertas de salud de emergencia enviadas','32K población en corredor de exposición'],
      wind:     ['Intensificación del viento — 52 km/h detectado','Velocidad de dispersión escalada significativamente'],
      humidity: ['Humedad relativa crítica — 8%','Riesgo crítico AQI elevado — todos los sectores'],
      worst:    ['Condiciones atmosféricas del peor caso activas','Todos los parámetros AQI en umbral crítico','Evacuación de emergencia de salud recomendada'],
    },
    // Air — Scenario Controls
    simulate:        'SIMULAR',
    scenarioWind:    'Viento Intensifica',
    scenarioHumidity:'Humedad Baja',
    scenarioWorst:   '⚠ Peor Caso',
    scenarioNone:    'Normal',
    // Air — AQI Overlay
    forecast2h:      'Pronóstico +2h',
    riskLevelLabel:  'Nivel de Riesgo',
    exposureProj:    'Proyección de Exposición',
    recommendations: 'Recomendaciones',
    recs: {
      low:       ['Monitorear calidad del aire','Actividades normales OK','Mantenerse informado'],
      moderate:  ['Evitar ejercicio al exterior','Cerrar ventanas y puertas','Grupos sensibles adentro'],
      high:      ['Usar mascarilla N95 al exterior','Cerrar ventanas y puertas','Evitar ejercicio al exterior','Grupos sensibles adentro'],
      very_high: ['Evacuar si es posible','Usar mascarilla N95 siempre','No salir al exterior','Servicios de emergencia en alerta'],
    },
  },
  en: {
    brandSub:        'Wildfire Intelligence',
    statusCritical:  'Critical Active',
    hotspots:        'HOTSPOTS',
    operational:     'OPERATIONAL',
    navDashboard:    'DASHBOARD',
    navAir:          'AIR QUALITY',
    airMonitor:      'AIR QUALITY MONITOR',
    welcome:         'Welcome to SENTINEL',
    loginSub:        'Enter your credentials to access the central monitoring command.',
    emailLabel:      'Operator Email',
    passwordLabel:   'Access Key',
    loginBtn:        'Sign In',
    orQuick:         'Or continue without account',
    demoBtn:         'View Demo →',
    noAccount:       "Don't have an account?",
    requestAccess:   'Request access here',
    hasAccount:      'Already have an account?',
    enter:           'Sign in here',
    threatAssessment:  'Threat Assessment',
    currentRisk:       'Current Risk Level',
    immediateAction:   'Immediate Action Required · Sector 7A',
    fireRadiativePower:'Fire Radiative Power',
    windConditions:    'Wind Conditions',
    airQualityIndex:   'Air Quality Index',
    aqiUnhealthy:      'UNHEALTHY',
    activeBroadcast:   'Active Broadcast',
    wildfireAlert:     '⚠ WILDFIRE ALERT:',
    evacuationOrder:   'Immediate evacuation ordered for Zone 7A–C. Proceed to shelter at Lincoln High School via Route 42.',
    recipients:        'Recipients',
    situationalIntel:  'Situational Intelligence',
    socialImpact:      'Social Impact',
    populationAtRisk:  'Population at Risk',
    evacuated:         'Evacuated',
    inShelters:        'In Shelters',
    evacuationProgress:'Evacuation Progress',
    escapeRoutes:      'Escape Routes',
    routeActive:       'ACTIVE',
    estTravel:         'Est. Travel',
    hwyClosed:         'HWY 9 CLOSED · HAZARD',
    officialBriefing:  'Official Briefing',
    execSummary:       'Exec Summary',
    containment:       'Containment at',
    windNote:          'NW winds pushing toward residential sectors.',
    incidentCommander: 'Incident Commander',
    riskLevel:   'Risk Level',
    airQuality:  'Air Quality',
    wind:        'Wind',
    firePower:   'Fire Power',
    safeRoute:   'Safe Route',
    estTravelTime:'Est. travel time',
    municipalBriefing: 'Municipal Briefing',
    personnel:   'Personnel',
    vehicles:    'Vehicles',
    aircraft:    'Aircraft',
    nextBriefing:'Next briefing: 18:00 UTC',
    atRisk:      'At Risk',
    structures:  'Structures',
    smokePropagation:  'Smoke Propagation Detected',
    activeSources:     'Active Sources',
    windLabel:         'Wind:',
    humidity:    'HUMIDITY',
    temperature: 'TEMP',
    visibility:  'VISIBILITY',
    aqiScale:    'AQI Scale',
    threatLow:      'THREAT: LOW',
    threatModerate: 'THREAT: MODERATE',
    threatHigh:     'THREAT: HIGH',
    threatCritical: 'THREAT: CRITICAL',
    aiResponsePlan: 'AI RESPONSE PLAN',
    generatedBy:    'Generated by SENTINEL AI ·',
    actions: {
      low:      ['Monitor air quality levels','Normal activities permitted','Keep emergency contacts ready'],
      moderate: ['Sensitive groups reduce outdoor time','Close windows in affected zones','Avoid strenuous outdoor exercise'],
      high:     ['Alert healthcare facilities','Suspend outdoor school activities','Deploy N95 masks to vulnerable zones','Avoid outdoor exercise — all groups','Prepare emergency response teams'],
      critical: ['IMMEDIATE: Evacuate affected zones','Suspend ALL outdoor activities','Deploy emergency medical units','Activate incident command center','Issue emergency broadcast alert','Request regional air support','Open emergency shelters'],
    },
    aiIntelligence: 'AI INTELLIGENCE',
    briefings: {
      low:      ['Air quality remains within acceptable parameters across all monitored zones.','PM2.5 density is minimal. No immediate risk to public health detected.','Wind conditions are favorable. Dispersion rates are adequate.'],
      moderate: ['PM2.5 propagation identified, moving toward residential sectors at 24 km/h.','AQI levels are approaching concerning thresholds in northwest districts.','Sensitive populations should begin precautionary indoor measures.'],
      high:     ['PM2.5 density is increasing toward populated sectors northwest of emission sources.','Projected AQI deterioration may affect vulnerable populations within 2 hours.','Wind vectoring at 315° is accelerating smoke drift toward the Temuco corridor.','Healthcare facilities in the affected radius have been placed on standby.'],
      critical: ['CRITICAL: PM2.5 concentration has exceeded safe exposure thresholds.','Emergency response teams have been activated across all affected zones.','Population in the primary exposure corridor must seek shelter immediately.','Air quality is projected to remain critical for the next 4–6 hours.'],
    },
    incidentLog: 'INCIDENT LOG',
    events: {
      base:     ['Pollution source detected — AQI rising','PM2.5 dispersion identified — NW sector','AQI threshold exceeded — zone B critical','AQI deterioration forecasted — 2h projection','Emergency health alerts dispatched','32K population in exposure corridor'],
      wind:     ['Wind intensification — 52 km/h detected','Dispersion velocity escalated significantly'],
      humidity: ['Relative humidity critical — 8%','AQI critical risk elevated — all sectors'],
      worst:    ['Worst-case atmospheric conditions active','All AQI parameters at critical threshold','Emergency health evacuation recommended'],
    },
    simulate:        'SIMULATE',
    scenarioWind:    'Wind Intensifies',
    scenarioHumidity:'Humidity Drops',
    scenarioWorst:   '⚠ Worst Case',
    scenarioNone:    'Normal',
    forecast2h:      '+2h Forecast',
    riskLevelLabel:  'Risk Level',
    exposureProj:    'Exposure Projection',
    recommendations: 'Recommendations',
    recs: {
      low:       ['Monitor air quality','Normal activities OK','Stay informed'],
      moderate:  ['Avoid outdoor exercise','Close windows and doors','Sensitive groups stay in'],
      high:      ['Wear N95 mask outdoors','Close windows and doors','Avoid outdoor exercise','Sensitive groups stay in'],
      very_high: ['Evacuate if possible','Wear N95 mask at all times','Do not go outdoors','Emergency services on alert'],
    },
  },
} satisfies Record<Lang, Record<string, unknown>>

type Tx = typeof t['es']
type LanguageCtx = { lang: Lang; toggle: () => void; tx: Tx }

const Ctx = createContext<LanguageCtx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('es')
  const toggle = () => setLang(l => l === 'es' ? 'en' : 'es')
  return <Ctx.Provider value={{ lang, toggle, tx: t[lang] as Tx }}>{children}</Ctx.Provider>
}

export function useLang() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang must be inside LanguageProvider')
  return ctx
}
