const fs = require('fs');

// ── 1. Load geonames (all cities15000)
console.log('Loading geonames...');
const geoRaw = fs.readFileSync('C:/Users/camil/Desktop/sentinel/cities_data/cities15000.txt', 'utf8');
const geoLines = geoRaw.split('\n').filter(Boolean);

// Build lookup: normalizedName+CC → { lat, lng, name }
const norm = s => s.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]/g, '').trim();

const geoCities = []; // all cities for final output
const geoIndex  = {}; // "normalizedName|CC" → index in geoCities

for (const line of geoLines) {
  const cols  = line.split('\t');
  const name  = cols[1]?.trim();
  const ascii = cols[2]?.trim();
  const lat   = parseFloat(cols[4]);
  const lng   = parseFloat(cols[5]);
  const cc    = cols[8]?.trim().toUpperCase();
  if (!name || isNaN(lat) || isNaN(lng) || !cc) continue;

  const idx = geoCities.length;
  geoCities.push({ name, ascii, lat, lng, cc });

  const keys = new Set([norm(name) + '|' + cc, norm(ascii) + '|' + cc]);
  for (const k of keys) {
    if (!geoIndex[k]) geoIndex[k] = idx; // first match wins
  }
}
console.log('Geonames cities:', geoCities.length);

// ── 2. Country name → ISO2
const nameToISO2 = {
  'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Andorra':'AD','Angola':'AO',
  'Argentina':'AR','Armenia':'AM','Aruba':'AW','Australia':'AU','Austria':'AT',
  'Azerbaijan':'AZ','Bahrain':'BH','Bangladesh':'BD','Barbados':'BB','Belarus':'BY',
  'Belgium':'BE','Belize':'BZ','Benin':'BJ','Bhutan':'BT',
  'Bolivia (Plurinational State of)':'BO','Bosnia and Herzegovina':'BA','Botswana':'BW',
  'Brazil':'BR','Bulgaria':'BG','Burkina Faso':'BF','Burundi':'BI','Cabo Verde':'CV',
  'Cambodia':'KH','Cameroon':'CM','Canada':'CA','Central African Republic':'CF',
  'Chad':'TD','Chile':'CL','China':'CN','Colombia':'CO','Comoros':'KM','Congo':'CG',
  'Costa Rica':'CR','Croatia':'HR','Cuba':'CU','Cyprus':'CY','Czechia':'CZ',
  "Cote d'Ivoire":'CI','Democratic Republic of the Congo':'CD','Denmark':'DK',
  'Dominican Republic':'DO','Ecuador':'EC','Egypt':'EG','El Salvador':'SV',
  'Equatorial Guinea':'GQ','Eritrea':'ER','Estonia':'EE','Ethiopia':'ET',
  'Finland':'FI','France':'FR','Gabon':'GA','Gambia':'GM','Georgia':'GE',
  'Germany':'DE','Ghana':'GH','Greece':'GR','Guatemala':'GT','Guinea':'GN',
  'Guinea-Bissau':'GW','Guyana':'GY','Haiti':'HT','Honduras':'HN','Hungary':'HU',
  'Iceland':'IS','India':'IN','Indonesia':'ID','Iran (Islamic Republic of)':'IR',
  'Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT','Jamaica':'JM','Japan':'JP',
  'Jordan':'JO','Kazakhstan':'KZ','Kenya':'KE','Kingdom of Eswatini':'SZ',
  'Kuwait':'KW','Kyrgyzstan':'KG',"Lao People's Democratic Republic":'LA',
  'Latvia':'LV','Lebanon':'LB','Lesotho':'LS','Liberia':'LR','Libya':'LY',
  'Lithuania':'LT','Luxembourg':'LU','Madagascar':'MG','Malawi':'MW','Malaysia':'MY',
  'Maldives':'MV','Mali':'ML','Malta':'MT','Mauritania':'MR','Mauritius':'MU',
  'Mexico':'MX','Monaco':'MC','Mongolia':'MN','Montenegro':'ME','Morocco':'MA',
  'Mozambique':'MZ','Myanmar':'MM','Namibia':'NA','Nepal':'NP','Netherlands':'NL',
  'New Zealand':'NZ','Nicaragua':'NI','Niger':'NE','Nigeria':'NG','Norway':'NO',
  'Oman':'OM','Pakistan':'PK','Palau':'PW','Panama':'PA','Papua New Guinea':'PG',
  'Paraguay':'PY','Peru':'PE','Philippines':'PH','Poland':'PL','Portugal':'PT',
  'Qatar':'QA','Republic of Korea':'KR','Republic of Moldova':'MD',
  'Republic of North Macedonia':'MK','Romania':'RO','Russian Federation':'RU',
  'Rwanda':'RW','Saint Kitts and Nevis':'KN','Saint Lucia':'LC','Saudi Arabia':'SA',
  'Senegal':'SN','Serbia':'RS','Seychelles':'SC','Sierra Leone':'SL','Singapore':'SG',
  'Slovakia':'SK','Slovenia':'SI','Solomon Islands':'SB','Somalia':'SO',
  'South Africa':'ZA','South Sudan':'SS','Spain':'ES','Sri Lanka':'LK',
  'State of Palestine':'PS','Sudan':'SD','Suriname':'SR','Sweden':'SE',
  'Switzerland':'CH','Syrian Arab Republic':'SY','Tajikistan':'TJ','Thailand':'TH',
  'Togo':'TG','Trinidad and Tobago':'TT','Tunisia':'TN','Turkey':'TR',
  'Turkmenistan':'TM','Uganda':'UG','Ukraine':'UA','United Arab Emirates':'AE',
  'United Kingdom of Great Britain and Northern Ireland':'GB',
  'United Republic of Tanzania':'TZ','United States of America':'US',
  'Uruguay':'UY','Uzbekistan':'UZ','Vanuatu':'VU',
  'Venezuela (Bolivarian Republic of)':'VE','Viet Nam':'VN',
  'Yemen':'YE','Zambia':'ZM','Zimbabwe':'ZW',
};

// ISO2 → country name (reverse)
const iso2ToName = Object.fromEntries(Object.entries(nameToISO2).map(([n, c]) => [c, n]));

// ── 3. Load CSV → aggregate AQI per city+country
console.log('Loading CSV...');
const csvRaw   = fs.readFileSync('C:/Users/camil/Downloads/air pollution dataset.csv', 'utf8');
const csvLines = csvRaw.replace(/\r/g, '').split('\n').filter(Boolean).slice(1);

const aqiByKey = {}; // "normName|CC" → { city, country, aqiVals, coVals, ozVals, no2Vals, pm25Vals }
for (const line of csvLines) {
  const cols    = line.split(',');
  const country = cols[0]?.trim();
  const city    = cols[1]?.trim();
  const aqi     = parseFloat(cols[2]);
  const co      = parseFloat(cols[4]);
  const ozone   = parseFloat(cols[6]);
  const no2     = parseFloat(cols[8]);
  const pm25    = parseFloat(cols[10]);
  if (!city || !country) continue;
  const cc  = nameToISO2[country];
  if (!cc) continue;
  const key = norm(city) + '|' + cc;
  if (!aqiByKey[key]) aqiByKey[key] = { city, country, aqiVals:[], coVals:[], ozVals:[], no2Vals:[], pm25Vals:[] };
  if (!isNaN(aqi))   aqiByKey[key].aqiVals.push(aqi);
  if (!isNaN(co))    aqiByKey[key].coVals.push(co);
  if (!isNaN(ozone)) aqiByKey[key].ozVals.push(ozone);
  if (!isNaN(no2))   aqiByKey[key].no2Vals.push(no2);
  if (!isNaN(pm25))  aqiByKey[key].pm25Vals.push(pm25);
}
console.log('AQI entries:', Object.keys(aqiByKey).length);

// ── 4. Build GeoJSON: every geonames city, colored if has AQI data
const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;

const features = [];
let withData = 0, noData = 0;

for (let i = 0; i < geoCities.length; i++) {
  const g   = geoCities[i];
  const key = norm(g.name) + '|' + g.cc;
  const d   = aqiByKey[key] || aqiByKey[norm(g.ascii) + '|' + g.cc];

  if (d) {
    const avgAQI = avg(d.aqiVals) || 0;
    const score  = Math.min(100, (avgAQI / 300) * 100);
    const cat    = score <= 25 ? 'good' : score <= 50 ? 'semi-good' : score <= 75 ? 'semi-bad' : 'bad';
    const pm25v  = avg(d.pm25Vals);
    const ozv    = avg(d.ozVals);
    const no2v   = avg(d.no2Vals);
    const cov    = avg(d.coVals);
    const pollMap = { 'PM2.5': pm25v, 'Ozone': ozv, 'NO2': no2v, 'CO': cov };
    const valid  = Object.entries(pollMap).filter(([, v]) => v !== null);
    const dominant = valid.length ? valid.reduce((a,b) => b[1] > a[1] ? b : a)[0] : 'PM2.5';
    const color = cat === 'good' ? '#10b981' : cat === 'semi-good' ? '#fbbf24' : cat === 'semi-bad' ? '#f97316' : '#ef4444';

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
      properties: {
        city: d.city, country: d.country,
        hasData: true,
        avgAQI:  Math.round(avgAQI * 10) / 10,
        score:   Math.round(score * 10) / 10,
        category: cat, color,
        pm25:    pm25v !== null ? Math.round(pm25v  * 10)/10 : null,
        ozone:   ozv   !== null ? Math.round(ozv    * 10)/10 : null,
        no2:     no2v  !== null ? Math.round(no2v   * 10)/10 : null,
        co:      cov   !== null ? Math.round(cov    * 10)/10 : null,
        dominant, records: d.aqiVals.length,
      }
    });
    withData++;
  } else {
    // No AQI data → gray
    const countryName = iso2ToName[g.cc] || g.cc;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
      properties: {
        city: g.name, country: countryName,
        hasData: false,
        avgAQI: null, score: null, category: 'none', color: '#475569',
        pm25: null, ozone: null, no2: null, co: null,
        dominant: null, records: 0,
      }
    });
    noData++;
  }
}

console.log(`With AQI data: ${withData} | Gray (no data): ${noData} | Total: ${features.length}`);

const geojson = { type: 'FeatureCollection', features };
fs.writeFileSync(
  'C:/Users/camil/Desktop/sentinel/frontend/public/air-cities.geojson',
  JSON.stringify(geojson)
);
console.log('Done! File size:', Math.round(fs.statSync('C:/Users/camil/Desktop/sentinel/frontend/public/air-cities.geojson').size / 1024), 'KB');
