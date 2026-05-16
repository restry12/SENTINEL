import { Router } from 'express'
import { getSupabaseClient, getSupabaseAdmin } from '../services/supabase'
import { getCityCoords } from '../services/geo'

const router = Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name, phone, countryCode, countryName, stateCode, stateName, cityName } = req.body as {
    email: string
    password: string
    name: string
    phone: string
    countryCode: string
    countryName: string
    stateCode: string
    stateName: string
    cityName: string
  }

  if (!email || !password || !name || !phone || !countryCode || !cityName) {
    res.status(400).json({ ok: false, error: 'Faltan campos requeridos: email, password, name, phone, countryCode, cityName' })
    return
  }

  const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
  const coords = getCityCoords(countryCode, stateCode, cityName)
  const admin = getSupabaseAdmin()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    res.status(400).json({ ok: false, error: authError?.message ?? 'Error al crear usuario' })
    return
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    name,
    phone: normalizedPhone,
    country_code: countryCode,
    country_name: countryName,
    state_code: stateCode ?? null,
    state_name: stateName ?? null,
    city_name: cityName,
    city_lat: coords?.lat ?? null,
    city_lon: coords?.lon ?? null,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    res.status(500).json({ ok: false, error: 'Error al guardar perfil: ' + profileError.message })
    return
  }

  console.log(`[auth] nuevo usuario: ${name} (${cityName}, ${countryName}) tel: ${normalizedPhone}`)
  res.json({ ok: true, userId: authData.user.id, message: 'Registro exitoso.' })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string }

  if (!email || !password) {
    res.status(400).json({ ok: false, error: 'Email y password requeridos' })
    return
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    res.status(401).json({ ok: false, error: 'Credenciales inválidas' })
    return
  }

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).single()

  res.json({
    ok: true,
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      ...profile,
    },
  })
})

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  }
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ ok: false, error: 'Token requerido' })
    return
  }

  const supabase = getSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    res.status(401).json({ ok: false, error: 'Token inválido o expirado' })
    return
  }

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()

  res.json({ ok: true, user: { id: user.id, email: user.email, ...profile } })
})

export default router
