require('dotenv').config();

const ZAVU_URL = 'https://api.zavu.dev/v1/messages';

async function sendAlert({ to, riskLevel, zona, frp }) {
  const emoji = riskLevel === 'critical' ? '🚨' : '⚠️';
  const text = `${emoji} SENTINEL ALERTA ${riskLevel.toUpperCase()} — Zona: ${zona}. FRP: ${frp} MW. Evacuar rutas seguras activas.`;

  const res = await fetch(ZAVU_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ZAVU_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.ZAVU_FROM_NUMBER,
      to,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zavu error ${res.status}: ${err}`);
  }

  return res.json();
}

module.exports = { sendAlert };
