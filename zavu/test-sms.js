require('dotenv').config();

async function sendTestSMS() {
  const res = await fetch('https://api.zavu.dev/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ZAVU_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.ZAVU_FROM_NUMBER,
      to: '+56993253397',
      text: '🔥 SENTINEL TEST — Sistema de alerta temprana activo. Foco detectado en zona de prueba. Este es un mensaje de verificación.',
    }),
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

sendTestSMS().catch(console.error);
