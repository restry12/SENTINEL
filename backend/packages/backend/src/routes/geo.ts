import { Router } from 'express'
import { getAllCountries, getStates, getCities } from '../services/geo'

const router = Router()

// GET /api/geo/countries
router.get('/countries', (_req, res) => {
  const countries = getAllCountries()
  res.json({ ok: true, count: countries.length, countries })
})

// GET /api/geo/states/:countryCode
router.get('/states/:countryCode', (req, res) => {
  const { countryCode } = req.params
  const states = getStates(countryCode.toUpperCase())
  res.json({ ok: true, count: states.length, states })
})

// GET /api/geo/cities/:countryCode/:stateCode
router.get('/cities/:countryCode/:stateCode', (req, res) => {
  const { countryCode, stateCode } = req.params
  const cities = getCities(countryCode.toUpperCase(), stateCode.toUpperCase())
  res.json({ ok: true, count: cities.length, cities })
})

export default router
