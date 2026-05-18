'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Mic, FileAudio, Play, Square, Download, Trash2 } from 'lucide-react'

export default function PresentacionPage() {
  const [file, setFile] = useState<File | null>(null)
  const [voiceId, setVoiceId] = useState<string>('')
  const [text, setText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  
  // Estados para grabación
  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Intentar formatos que MiniMax acepte más fácilmente (mp4/m4a)
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : 'audio/webm' // Fallback si no hay de otra
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setRecordedUrl(url)
        
        const recordedFile = new File([blob], `grabacion.${extension}`, { type: mimeType })
        setFile(recordedFile)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      alert('No se pudo acceder al micrófono o el formato no es soportado')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const handleClone = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/voice?action=clone', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.voice_id) {
        setVoiceId(data.voice_id)
        alert('¡Voz clonada con éxito! Ahora puedes escribir el guion.')
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
    } catch (e: any) {
      alert(`Error al clonar voz: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!voiceId || !text) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('voice_id', voiceId)
      fd.append('text', text)
      const res = await fetch('/api/voice?action=generate', { method: 'POST', body: fd })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch (e) {
      alert('Error al generar audio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto py-10 space-y-8">
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Mic className="text-primary" /> Sentinel Voice Clone
          </CardTitle>
          <CardDescription>
            Paso 1: Graba 30 segundos o sube un audio para clonar tu voz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {!isRecording ? (
              <Button onClick={startRecording} variant="outline" className="h-20 flex flex-col gap-2">
                <Mic className="h-6 w-6 text-red-500" />
                Grabar ahora
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="h-20 flex flex-col gap-2 animate-pulse">
                <Square className="h-6 w-6" />
                Detener
              </Button>
            )}
            
            <div className="relative">
              <Input 
                type="file" 
                accept="audio/*" 
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null)
                  setRecordedUrl(null)
                }}
                className="hidden" 
                id="audio-upload"
              />
              <label 
                htmlFor="audio-upload" 
                className="flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <FileAudio className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs mt-1">Subir archivo</span>
              </label>
            </div>
          </div>

          {recordedUrl && (
            <div className="bg-muted p-3 rounded-lg flex items-center gap-3">
              <audio src={recordedUrl} controls className="h-8 flex-1" />
              <Button variant="ghost" size="icon" onClick={() => {setRecordedUrl(null); setFile(null)}}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}

          {file && !recordedUrl && (
            <p className="text-sm font-medium text-center">Archivo seleccionado: {file.name}</p>
          )}

          <Button 
            onClick={handleClone} 
            disabled={!file || loading} 
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <FileAudio className="mr-2" />}
            Clonar mi voz con este audio
          </Button>

          {voiceId && (
            <div className="text-center">
              <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                VOZ CLONADA: {voiceId}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-secondary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">El Guion</CardTitle>
          <CardDescription>
            Escribe el texto de tu presentación. MiniMax lo dirá con tu voz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="Escribe aquí tu discurso..." 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[200px] text-lg p-4"
          />
          <Button 
            onClick={handleGenerate} 
            disabled={!voiceId || !text || loading} 
            variant="secondary"
            className="w-full font-bold py-6"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2" />}
            Generar Audio Final
          </Button>
        </CardContent>
      </Card>

      {audioUrl && (
        <Card className="bg-green-50 border-2 border-green-500 shadow-xl animate-in zoom-in-95 duration-300">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <Download className="h-5 w-5" /> ¡Audio listo para descargar!
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 pb-8">
            <audio controls src={audioUrl} className="w-full" />
            <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white w-full max-w-xs shadow-md">
              <a href={audioUrl} download="presentacion_sentinel_clon.mp3">
                <Download className="mr-2 h-5 w-5" /> Descargar MP3
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
