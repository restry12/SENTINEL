import { Country, State, City } from 'country-state-city'

export interface GeoCountry {
  code: string
  name: string
  phoneCode: string
  flag: string
}

export interface GeoState {
  code: string
  name: string
  countryCode: string
}

export interface GeoCity {
  name: string
  stateCode: string
  countryCode: string
  lat: number | null
  lon: number | null
}

export function getAllCountries(): GeoCountry[] {
  return Country.getAllCountries().map(c => ({
    code: c.isoCode,
    name: c.name,
    phoneCode: c.phonecode,
    flag: c.flag ?? '',
  }))
}

export function getStates(countryCode: string): GeoState[] {
  return State.getStatesOfCountry(countryCode).map(s => ({
    code: s.isoCode,
    name: s.name,
    countryCode: s.countryCode,
  }))
}

export function getCities(countryCode: string, stateCode: string): GeoCity[] {
  return City.getCitiesOfState(countryCode, stateCode).map(c => ({
    name: c.name,
    stateCode: c.stateCode,
    countryCode: c.countryCode,
    lat: c.latitude ? parseFloat(c.latitude) : null,
    lon: c.longitude ? parseFloat(c.longitude) : null,
  }))
}

export function getCityCoords(
  countryCode: string,
  stateCode: string,
  cityName: string
): { lat: number; lon: number } | null {
  const cities = City.getCitiesOfState(countryCode, stateCode)
  const city = cities.find(c => c.name === cityName)
  if (!city || !city.latitude || !city.longitude) return null
  return { lat: parseFloat(city.latitude), lon: parseFloat(city.longitude) }
}
