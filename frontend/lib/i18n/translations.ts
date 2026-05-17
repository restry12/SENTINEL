export const translations = {
  es: {
    // Header
    headerNasa: 'NASA FIRMS CONECTADO',
    headerSat: '04 ENLACES SATELITALES',
    headerTime: 'HORA DEL SISTEMA',
    langToggle: 'EN',

    // Visual scene
    badgeRestricted: 'ACCESO RESTRINGIDO',
    heroTitleBefore: 'Centro de Comando para Inteligencia de Incendios en',
    heroTitleHighlight: 'Tiempo Real.',
    heroTitleAfter: '',
    heroSub: 'Aprovechando telemetría NASA FIRMS, análisis con IA y rutas de evacuación autónomas.',
    pillFirms: 'NASA FIRMS EN VIVO',
    pillGlobal: 'VIGILANCIA GLOBAL ACTIVA',
    pillSms: 'ALERTAS SMS LISTAS',

    // Telemetry tiles
    tileHotspots: 'FOCOS · 24H',
    tileCoverage: 'COBERTURA GLOBAL',
    tileAlerts: 'ALERTAS ENVIADAS',
    tileLatency: 'LATENCIA FIRMS',

    // Auth card
    tabLogin: 'Iniciar Sesión',
    tabRegister: 'Registrarse',
    footerNoAccount: '¿No tiene una cuenta?',
    footerRequestAccess: 'Solicite acceso aquí',
    footerHasAccount: '¿Ya tiene una cuenta?',
    footerSignIn: 'Ingrese aquí',

    // Login form
    loginTitle: 'Bienvenido a SENTINEL',
    loginSub: 'Ingrese sus credenciales para acceder al comando central de monitoreo.',
    loginEmailLabel: 'Email de Operador',
    loginEmailPlaceholder: 'operador@sentinel.air',
    loginPasswordLabel: 'Clave de Acceso',
    loginButton: 'Iniciar Sesión',
    loginDivider: 'O continúa sin cuenta',
    loginDemo: 'Ver Demo →',
    loginSuccessTitle: 'Acceso concedido',
    loginSuccessDesc: 'Sincronizando con el centro de comando...',
    loginErrorTitle: 'Error de acceso',
    loginErrorDesc: 'Credenciales inválidas o cuenta no autorizada.',
    loginConnErrorTitle: 'Error de conexión',
    loginConnErrorDesc: 'No se pudo contactar con el servidor de autenticación.',
    zodLoginEmail: 'Email inválido',
    zodLoginPassword: 'Contraseña requerida',

    // Register form
    registerTitle: 'Registro de Operador',
    registerSub: 'Cree su cuenta para recibir alertas críticas y gestionar zonas de cobertura.',
    registerNameLabel: 'Nombre Completo',
    registerPhoneLabel: 'Teléfono (Alertas)',
    registerEmailLabel: 'Email Institucional',
    registerEmailPlaceholder: 'operador@institucion.cl',
    registerCityLabel: 'Comuna / Ciudad',
    registerCityPlaceholder: 'Ej: Valparaíso',
    registerPasswordLabel: 'Clave',
    registerPasswordPlaceholder: 'Min. 10 car.',
    registerConfirmLabel: 'Confirmar',
    registerConfirmPlaceholder: 'Repetir clave',
    registerButton: 'Crear Cuenta Operativa',
    registerSuccessTitle: 'Cuenta creada',
    registerSuccessDesc: 'Cuenta registrada. Inicie sesión para continuar.',
    registerErrorTitle: 'Error de registro',
    registerErrorDesc: 'No se pudo crear la cuenta.',
    registerConnErrorTitle: 'Error de conexión',
    registerConnErrorDesc: 'No se pudo contactar el servidor de autenticación.',
    zodRegNameShort: 'Nombre demasiado corto',
    zodRegEmail: 'Email inválido',
    zodRegPhone: 'Número de teléfono inválido (ej: +56912345678)',
    zodRegCity: 'Comuna/Ciudad requerida',
    zodRegPasswordMin: 'La clave debe tener al menos 10 caracteres',
    zodRegPasswordMatch: 'Las claves no coinciden',
  },
} as const

export type Lang = 'es'
export type TranslationKey = keyof typeof translations.es
