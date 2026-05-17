"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Send, RotateCcw, Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (message: string) => void
  onClear: () => void
  disabled: boolean
}

export function ChatInput({ onSend, onClear, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Audio visualization refs
  const circleRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const recognitionRef = useRef<any>(null)

  const initialValueRef = useRef("")

  useEffect(() => {
    return () => {
      stopAudioAnalysis()
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const stopAudioAnalysis = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    audioContextRef.current = null
    streamRef.current = null
    animationRef.current = null
  }

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        const scale = 1 + (average / 255) * 1.5 // Multiplicador de escala basado en el volumen
        
        if (circleRef.current) {
          circleRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`
        }

        animationRef.current = requestAnimationFrame(updateVolume)
      }
      updateVolume()
    } catch (err) {
      console.error("Error accessing microphone for visualization", err)
    }
  }

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      return
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador.")
      return
    }

    initialValueRef.current = value

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = "es-CL"
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      startAudioAnalysis()
    }

    recognition.onresult = (event: any) => {
      let currentInterim = ""
      let currentFinal = ""

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript
        } else {
          currentInterim += event.results[i][0].transcript
        }
      }

      if (currentFinal) {
        initialValueRef.current = (initialValueRef.current + " " + currentFinal).trim()
      }

      const displayValue = (initialValueRef.current + " " + currentInterim).trim()
      setValue(displayValue)
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto"
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
        }
      }, 0)
    }

    recognition.onend = () => {
      setIsListening(false)
      stopAudioAnalysis()
    }

    recognition.onerror = () => {
      setIsListening(false)
      stopAudioAnalysis()
    }

    recognition.start()
  }

  return (
    <>
      {isListening && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all">
          <div className="relative">
            {/* Círculo animado que reacciona al sonido */}
            <div 
              ref={circleRef}
              className="absolute top-1/2 left-1/2 w-48 h-48 bg-red-500/30 rounded-full blur-xl transition-transform duration-75 pointer-events-none"
              style={{ transform: "translate(-50%, -50%) scale(1)" }}
            />
            {/* Micrófono central */}
            <button 
              onClick={toggleListening}
              className="relative z-10 w-28 h-28 bg-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/20 hover:scale-105 transition-transform"
            >
              <Mic className="w-12 h-12 text-white" />
            </button>
            <p className="absolute top-full left-1/2 -translate-x-1/2 mt-8 text-white/90 font-medium whitespace-nowrap text-xl animate-pulse">
              Escuchando... (Click para detener)
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 py-4">
        <div className="flex items-end gap-3">
          {/* Clear button */}
          <button
            onClick={onClear}
            disabled={disabled}
            title="Nueva conversación"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Mic button */}
          <button
            onClick={toggleListening}
            disabled={disabled}
            title={isListening ? "Detener" : "Dictar por voz"}
            className={cn(
              "w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border transition-colors",
              isListening
                ? "bg-red-500/80 text-white border-red-500/50"
                : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/70 disabled:opacity-30"
            )}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              disabled={disabled}
              placeholder="Pregunta sobre la situación actual..."
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30",
                "focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20",
                "transition-colors disabled:opacity-50",
                "max-h-40 leading-relaxed"
              )}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className={cn(
              "w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-all",
              "bg-orange-500/80 hover:bg-orange-500 border border-orange-500/50",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              "text-white"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] text-white/20 mt-2 text-center font-mono tracking-wide">
          SENTINEL AI · Mistral Large · Datos NASA FIRMS · Solo fines operacionales
        </p>
      </div>
    </>
  )
}
