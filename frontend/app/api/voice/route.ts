import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.MINIMAX_API_KEY
const GROUP_ID = process.env.MINIMAX_GROUP_ID

export async function POST(req: NextRequest) {
  if (!API_KEY || !GROUP_ID) {
    return NextResponse.json({ error: 'MiniMax tokens not configured' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const action = req.nextUrl.searchParams.get('action')

    // ACCIÓN 1: SUBIR AUDIO Y CLONAR
    if (action === 'clone') {
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

      // 1. Subir a MiniMax
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('purpose', 'voice_clone')

      const uploadRes = await fetch(`https://api.minimax.io/v1/files/upload?GroupId=${GROUP_ID}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        body: uploadData
      })
      
      const uploadJson = await uploadRes.json()
      
      if (!uploadRes.ok || !uploadJson.file?.file_id) {
        console.error('MiniMax Upload Error Details:', {
          status: uploadRes.status,
          statusText: uploadRes.statusText,
          body: uploadJson
        })
        throw new Error(`MiniMax upload failed: ${uploadJson.base_resp?.status_msg || 'Unknown error'}`)
      }

      const fileId = uploadJson.file?.file_id

      // 2. Crear el clon (voice_id)
      const voiceId = `clon_${Date.now()}`
      const cloneRes = await fetch(`https://api.minimax.io/v1/voice_clone?GroupId=${GROUP_ID}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: fileId,
          voice_id: voiceId
        })
      })
      
      return NextResponse.json({ ok: true, voice_id: voiceId })
    }

    // ACCIÓN 2: GENERAR AUDIO DESDE TEXTO (TTS)
    if (action === 'generate') {
      const text = formData.get('text') as string
      const voiceId = formData.get('voice_id') as string

      if (!text || !voiceId) return NextResponse.json({ error: 'Missing text or voice_id' }, { status: 400 })

      const ttsRes = await fetch(`https://api.minimax.io/v1/text_to_speech/v2?GroupId=${GROUP_ID}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "speech-01-turbo",
          text: text,
          stream: false,
          voice_setting: {
            voice_id: voiceId,
            speed: 1.0,
            vol: 1.0,
            pitch: 0
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3"
          }
        })
      })

      if (!ttsRes.ok) {
        const err = await ttsRes.text()
        throw new Error(`TTS Error: ${err}`)
      }

      const audioBuffer = await ttsRes.arrayBuffer()
      return new Response(audioBuffer, {
        headers: { 'Content-Type': 'audio/mpeg' }
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Voice API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
