import type { GridPoint } from "@/components/tornado/world-tornado-map"

export interface AdminBoundaryFeature {
  type: "Feature"
  bbox?: [number, number, number, number]
  properties: {
    adm0_a3?: string
    admin?: string
  }
  geometry: {
    type: "Polygon" | "MultiPolygon"
    coordinates: number[][][] | number[][][][]
  }
}

export interface AdminBoundaryCollection {
  type: "FeatureCollection"
  features: AdminBoundaryFeature[]
}

export const RISK_PRIORITY: Record<string, number> = {
  LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4,
}

export const COUNTRY_BBOX: Record<string, [number, number, number, number]> = {
  USA:[-125,24,-66,50],CAN:[-141,42,-52,72],MEX:[-118,14,-86,33],
  BRA:[-74,-34,-34,6],ARG:[-74,-56,-53,-21],CHL:[-76,-56,-66,-17],
  COL:[-80,-5,-66,13],VEN:[-73,0,-59,12],PER:[-82,-19,-68,0],
  ECU:[-81,-5,-75,2],BOL:[-70,-23,-57,-9],PRY:[-63,-28,-54,-19],
  URY:[-59,-35,-53,-30],GUY:[-62,1,-56,9],SUR:[-58,1,-53,6],
  CUB:[-85,19,-74,24],DOM:[-72,17,-68,20],HTI:[-75,18,-71,20],
  JAM:[-79,17,-76,19],TTO:[-62,10,-60,11],
  GTM:[-92,13,-88,18],BLZ:[-89,15,-87,19],HND:[-90,13,-83,16],
  SLV:[-91,13,-87,15],NIC:[-88,10,-83,15],CRI:[-86,8,-82,11],PAN:[-83,7,-77,10],
  GBR:[-9,49,2,61],FRA:[-5,42,9,51],ESP:[-10,36,4,44],PRT:[-10,37,-6,42],
  DEU:[5,47,15,55],ITA:[6,36,19,47],NLD:[3,50,8,54],BEL:[2,49,7,52],
  CHE:[5,45,11,48],AUT:[9,46,17,49],IRL:[-11,51,-5,56],
  NOR:[4,57,31,72],SWE:[10,55,25,70],FIN:[19,59,32,70],DNK:[8,54,13,58],
  POL:[14,49,25,55],UKR:[22,44,41,53],ROU:[20,43,30,48],
  HUN:[16,45,23,49],CZE:[12,48,19,52],BGR:[22,41,29,44],
  SRB:[18,42,23,47],HRV:[13,42,20,47],GRC:[19,34,30,42],
  TUR:[25,35,45,42],ALB:[19,39,22,43],
  RUS:[27,41,180,72],KAZ:[46,40,88,56],UZB:[56,37,74,46],TKM:[52,35,67,43],
  KGZ:[69,39,81,44],TJK:[67,36,75,41],
  IND:[68,6,98,36],PAK:[60,23,78,37],BGD:[88,20,93,27],
  NPL:[80,26,89,31],LKA:[79,5,82,10],MMR:[92,9,102,29],
  AFG:[60,29,75,39],IRN:[44,25,64,40],IRQ:[38,29,49,38],
  SYR:[35,32,42,38],JOR:[34,29,40,34],ISR:[34,29,36,34],
  SAU:[34,16,56,33],ARE:[51,22,57,27],OMN:[51,16,60,27],
  YEM:[42,12,54,19],KWT:[46,28,49,30],QAT:[50,24,52,27],
  LBN:[35,33,37,35],
  THA:[97,5,106,21],VNM:[102,8,110,24],KHM:[102,10,108,15],
  LAO:[100,13,108,23],MYS:[99,0,120,8],IDN:[95,-11,141,6],
  PHL:[116,4,127,21],SGP:[103,1,104,2],
  CHN:[73,18,135,54],JPN:[128,30,146,46],KOR:[124,33,132,39],MNG:[87,41,120,52],
  AUS:[112,-44,154,-10],NZL:[165,-48,179,-33],
  NGA:[-0,4,15,14],GHA:[-4,4,2,12],CIV:[-9,4,-2,11],
  SEN:[-18,12,-11,17],MLI:[-12,10,5,25],BFA:[-6,9,3,15],
  NER:[0,11,16,24],CMR:[8,1,17,13],TCD:[13,7,24,24],
  ETH:[33,3,48,15],KEN:[33,-5,42,5],TZA:[29,-12,41,0],
  UGA:[29,-2,35,5],RWA:[28,-3,31,0],SOM:[40,-2,52,12],
  SDN:[21,8,39,23],SSD:[24,3,36,13],
  ZAF:[16,-35,33,-22],BWA:[19,-27,30,-17],NAM:[11,-29,26,-17],
  ZMB:[21,-18,34,-8],ZWE:[25,-23,34,-15],MOZ:[30,-27,41,-10],
  MWI:[32,-17,36,-9],MDG:[43,-26,51,-11],AGO:[11,-18,24,-4],
  COD:[12,-14,32,6],COG:[11,-5,19,4],
  EGY:[24,22,37,32],LBY:[9,19,26,34],TUN:[7,30,12,38],
  MAR:[-13,27,-1,36],DZA:[-9,18,12,38],
}

export const ISO_NAME: Record<string, string> = {
  USA:"United States",CAN:"Canada",MEX:"Mexico",BRA:"Brazil",ARG:"Argentina",
  CHL:"Chile",COL:"Colombia",VEN:"Venezuela",PER:"Peru",ECU:"Ecuador",
  BOL:"Bolivia",PRY:"Paraguay",URY:"Uruguay",GUY:"Guyana",SUR:"Suriname",
  CUB:"Cuba",DOM:"Dominican Rep.",HTI:"Haiti",JAM:"Jamaica",TTO:"Trinidad",
  GTM:"Guatemala",BLZ:"Belize",HND:"Honduras",SLV:"El Salvador",
  NIC:"Nicaragua",CRI:"Costa Rica",PAN:"Panama",
  GBR:"United Kingdom",FRA:"France",ESP:"Spain",PRT:"Portugal",
  DEU:"Germany",ITA:"Italy",NLD:"Netherlands",BEL:"Belgium",
  CHE:"Switzerland",AUT:"Austria",IRL:"Ireland",NOR:"Norway",SWE:"Sweden",
  FIN:"Finland",DNK:"Denmark",POL:"Poland",UKR:"Ukraine",ROU:"Romania",
  HUN:"Hungary",CZE:"Czechia",BGR:"Bulgaria",SRB:"Serbia",HRV:"Croatia",
  GRC:"Greece",TUR:"Turkey",ALB:"Albania",
  RUS:"Russia",KAZ:"Kazakhstan",UZB:"Uzbekistan",TKM:"Turkmenistan",
  KGZ:"Kyrgyzstan",TJK:"Tajikistan",
  IND:"India",PAK:"Pakistan",BGD:"Bangladesh",NPL:"Nepal",LKA:"Sri Lanka",
  MMR:"Myanmar",AFG:"Afghanistan",IRN:"Iran",IRQ:"Iraq",SYR:"Syria",
  JOR:"Jordan",ISR:"Israel",SAU:"Saudi Arabia",ARE:"UAE",OMN:"Oman",
  YEM:"Yemen",KWT:"Kuwait",QAT:"Qatar",LBN:"Lebanon",
  THA:"Thailand",VNM:"Vietnam",KHM:"Cambodia",LAO:"Laos",MYS:"Malaysia",
  IDN:"Indonesia",PHL:"Philippines",SGP:"Singapore",
  CHN:"China",JPN:"Japan",KOR:"South Korea",MNG:"Mongolia",
  AUS:"Australia",NZL:"New Zealand",
  NGA:"Nigeria",GHA:"Ghana",CIV:"Ivory Coast",SEN:"Senegal",MLI:"Mali",
  BFA:"Burkina Faso",NER:"Niger",CMR:"Cameroon",TCD:"Chad",
  ETH:"Ethiopia",KEN:"Kenya",TZA:"Tanzania",UGA:"Uganda",RWA:"Rwanda",
  SOM:"Somalia",SDN:"Sudan",SSD:"South Sudan",
  ZAF:"South Africa",BWA:"Botswana",NAM:"Namibia",ZMB:"Zambia",
  ZWE:"Zimbabwe",MOZ:"Mozambique",MWI:"Malawi",MDG:"Madagascar",
  AGO:"Angola",COD:"DR Congo",COG:"Congo",
  EGY:"Egypt",LBY:"Libya",TUN:"Tunisia",MAR:"Morocco",DZA:"Algeria",
}

export function findCountryForPoint(lat: number, lon: number): string | null {
  const prioritized = ["SGP","QAT","KWT","LBN","JOR","ISR","BLZ","SLV","JAM","TTO","RWA",
    "HRV","SVN","CHE","AUT","BEL","NLD","DNK","ALB","BGR","SRB","HUN","CZE",
    "DOM","HTI","CUB","CRI","PAN","NIC","HND","GTM","SUR","GUY","URY","PRY","ECU","BOL",
    "KOR","JPN","NPL","BGD","LKA","KHM","LAO","VNM","THA","PHL","MYS",
    "NZL","GBR","IRL","PRT","ESP","FRA","DEU","ITA","NOR","SWE","FIN","POL",
    "UKR","ROU","GRC","TUR","IRQ","SYR","AFG","PAK","IRN","SAU","ARE","OMN","YEM",
    "EGY","LBY","TUN","MAR","DZA","SEN","MLI","GHA","NGA","CMR","NER","BFA","CIV",
    "TCD","ETH","KEN","TZA","UGA","SOM","SDN","SSD",
    "ZAF","BWA","NAM","ZMB","ZWE","MOZ","MWI","MDG","AGO","COD","COG",
    "MEX","COL","VEN","PER","CHL","ARG","BRA",
    "IND","CHN","MNG","IDN","AUS","KAZ","UZB","TKM","KGZ","TJK","RUS",
    "USA","CAN","MMR","LBN"]

  for (const iso of prioritized) {
    const bbox = COUNTRY_BBOX[iso]
    if (!bbox) continue
    const [w, s, e, n] = bbox
    if (lat >= s && lat <= n && lon >= w && lon <= e) return iso
  }
  return null
}

function pointInRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersects = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(lat: number, lon: number, polygon: number[][][]): boolean {
  if (!polygon.length || !pointInRing(lat, lon, polygon[0])) return false
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lat, lon, polygon[i])) return false
  }
  return true
}

export function findCountryForPointInBoundaries(
  lat: number,
  lon: number,
  boundaries: AdminBoundaryFeature[]
): string | null {
  for (const feature of boundaries) {
    const [w, s, e, n] = feature.bbox ?? [-180, -90, 180, 90]
    if (lon < w || lon > e || lat < s || lat > n) continue

    const iso = feature.properties.adm0_a3
    if (!iso) continue

    if (feature.geometry.type === "Polygon") {
      if (pointInPolygon(lat, lon, feature.geometry.coordinates as number[][][])) return iso
    } else {
      const polygons = feature.geometry.coordinates as number[][][][]
      if (polygons.some(polygon => pointInPolygon(lat, lon, polygon))) return iso
    }
  }
  return null
}

export function assignPointCountries(points: GridPoint[], boundaries: AdminBoundaryFeature[]): GridPoint[] {
  return points.map(point => ({
    ...point,
    country_iso: findCountryForPointInBoundaries(point.lat, point.lon, boundaries) ?? findCountryForPoint(point.lat, point.lon),
  }))
}

export function aggregatePointsByCountry(points: GridPoint[]): Record<string, { risk: string; points: GridPoint[] }> {
  const result: Record<string, { risk: string; points: GridPoint[] }> = {}
  
  // Group points by country
  for (const p of points) {
    const iso = p.country_iso ?? findCountryForPoint(p.lat, p.lon)
    if (!iso) continue
    if (!result[iso]) result[iso] = { risk: "LOW", points: [] }
    result[iso].points.push(p)
  }

  // Calculate average score and assign risk category
  for (const iso in result) {
    const countryPoints = result[iso].points
    if (countryPoints.length === 0) continue
    
    const avgScore = countryPoints.reduce((sum, p) => sum + p.score, 0) / countryPoints.length
    
    if (avgScore <= 25) {
      result[iso].risk = "LOW"
    } else if (avgScore <= 50) {
      result[iso].risk = "MODERATE"
    } else if (avgScore <= 75) {
      result[iso].risk = "HIGH"
    } else {
      result[iso].risk = "CRITICAL"
    }
  }

  return result
}
