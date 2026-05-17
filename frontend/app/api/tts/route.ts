export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Heurística rápida para detectar español vs inglés
    const isSpanish = (str: string) => {
      // 1. Chequear caracteres exclusivos del español
      if (/[áéíóúñ¿¡]/i.test(str)) return true;
      
      // 2. Contar palabras comunes si no hay caracteres especiales
      const lower = " " + str.toLowerCase() + " ";
      const esWords = [' el ', ' la ', ' de ', ' que ', ' y ', ' en ', ' un ', ' con ', ' por ', ' para ', ' como ', ' es '];
      const enWords = [' the ', ' is ', ' of ', ' to ', ' and ', ' in ', ' a ', ' with ', ' for ', ' as ', ' that ', ' it '];
      
      let esCount = 0;
      let enCount = 0;
      
      esWords.forEach(w => { if (lower.includes(w)) esCount++; });
      enWords.forEach(w => { if (lower.includes(w)) enCount++; });
      
      return esCount >= enCount; // Por defecto español en caso de empate
    }

    // Limpiar Markdown para que no lea los asteriscos ni símbolos
    const cleanText = text
      .replace(/\*\*/g, '') // Quita negritas
      .replace(/\*/g, '')   // Quita cursivas o viñetas
      .replace(/#/g, '')    // Quita símbolos de títulos
      .replace(/-/g, '')    // Quita guiones de listas
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Quita formato de links pero deja el texto
      .replace(/`/g, '')    // Quita formato de código
      .replace(/\n+/g, ' '); // Reemplaza saltos de línea por espacios

    const selectedVoice = isSpanish(text) ? "Spanish_EnergeticBoy" : "English_Trustworth_Man";

    const groupId = process.env.MINIMAX_GROUP_ID || "";
    const url = `https://api.minimaxi.chat/v1/t2a_v2${groupId ? `?GroupId=${groupId}` : ''}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "speech-2.8-hd", // Este es el modelo que incluye tu Token Plan Max
        text: cleanText,
        voice_setting: {
          voice_id: selectedVoice, 
          speed: 1.25, // Rápido y enérgico
          pitch: 1,    // Ligeramente agudo, pero apoyándose en la voz base de "niño/joven"
          vol: 1.0
        }
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return new Response(JSON.stringify({ error: "MiniMax API error", details: errText }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await response.json()
    const audioHex = data.data?.audio

    if (!audioHex) {
      return new Response(JSON.stringify({ error: "No audio data returned" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Hex to Uint8Array for edge runtime
    const bytes = new Uint8Array(audioHex.length / 2)
    for (let i = 0; i < audioHex.length; i += 2) {
      bytes[i / 2] = parseInt(audioHex.substring(i, i + 2), 16)
    }

    return new Response(bytes, {
      headers: {
        "Content-Type": "audio/mp3"
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
