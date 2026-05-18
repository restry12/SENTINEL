'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type Lang = 'es'

export const t = {
  es: {
    // TopBar
    brandSub:        'Inteligencia de Amenazas Ambientales',
    statusCritical:  'Crítico Activo',
    hotspots:        'FOCOS',
    operational:     'OPERACIONAL',
    navDashboard:    'INCENDIOS',
    navAir:          'CALIDAD AIRE',
    navNews:         'NOTICIAS',
    navTornado:      'TORNADOS',
    navGlaciares:    'GLACIARES',
    navChat:         'Newen IA',
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
    // Left Panel — global view
    threatAssessment:  'Evaluación de Amenaza',
    currentRisk:       'Nivel de Riesgo Actual',
    immediateAction:   'Acción Inmediata Requerida',
    fireRadiativePower:'Potencia Radiativa del Fuego',
    windConditions:    'Condiciones de Viento',
    airQualityIndex:   'Índice de Calidad del Aire',
    aqiUnhealthy:      'NO SALUDABLE',
    activeBroadcast:   'Transmisión Activa',
    wildfireAlert:     '⚠ ALERTA INCENDIO:',
    evacuationOrder:   'Evacuación inmediata ordenada. Diríjase al punto de encuentro asignado.',
    recipients:        'Receptores',
    activeFireCount:   'Focos Activos',
    criticalFires:     'CRÍTICO',
    highFires:         'ALTO',
    moderateFires:     'MODERADO',
    pm25Label:         'PM2.5',
    // Left Panel — fire selected view
    fireDetails:       'Detalles del Foco',
    fireId:            'ID de Incendio',
    frpLabel:          'Potencia FRP',
    brightnessLabel:   'Brillo',
    expansionProj:     'Proyección de Expansión',
    windImpact:        'Impacto del Viento',
    spreading:         'Propagando hacia',
    backToOverview:    '← Vista General',
    // Right Panel — global view
    situationalIntel:  'Inteligencia Situacional',
    socialImpact:      'Impacto Social',
    populationAtRisk:  'Población en Riesgo',
    evacuated:         'Evacuados',
    inShelters:        'En Refugios',
    evacuationProgress:'Progreso de Evacuación',
    escapeRoutes:      'Rutas de Escape',
    routeActive:       'ACTIVA',
    estTravel:         'Tiempo Est.',
    hwyClosed:         'RUTA BLOQUEADA',
    noRouteData:       'Sin datos de ruta',
    awaitingBriefing:  'Esperando informe de la situación...',
    officialBriefing:  'Informe Oficial',
    execSummary:       'Resumen Ejecutivo',
    containment:       'Contención al',
    windNote:          'Vientos NW empujando hacia sectores residenciales.',
    incidentCommander: 'Comandante de Incidente',
    immediateActions:  'Acciones Inmediatas',
    // Right Panel — fire selected view
    fireOpsIntel:      'Intel Operativa',
    nearbyInfra:       'Infraestructura Cercana',
    noInfraIn10km:     'Sin infraestructura en 10 km',
    evacZones:         'Zonas de Evacuación Prioritaria',
    recommendedRes:    'Recursos Recomendados',
    nearestSafeRoute:  'Ruta al Punto Seguro',
    backToSituation:   '← Vista Situacional',
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
    nextBriefing:'Esperando próximo informe',
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
    noIncidents: 'Sin incidentes registrados',
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
}

type Tx = typeof t['es']
type LanguageCtx = { lang: Lang; tx: Tx }

const Ctx = createContext<LanguageCtx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang: Lang = 'es'
  return <Ctx.Provider value={{ lang, tx: t[lang] }}>{children}</Ctx.Provider>
}

export function useLang() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang must be inside LanguageProvider')
  return ctx
}
