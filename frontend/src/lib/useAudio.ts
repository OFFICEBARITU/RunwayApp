'use client'
import { useRef, useState, useCallback } from 'react'

export function useAudio() {
  const bgRef = useRef<HTMLAudioElement | null>(null)
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  const [bgEnabled, setBgEnabled] = useState(true)
  const [bgReady, setBgReady] = useState(false)

  const initBackground = useCallback(() => {
    if (bgRef.current) return
    const audio = new Audio('/audio/background.mp3')
    audio.loop = true
    audio.volume = 0.12
    bgRef.current = audio
    audio.addEventListener('canplaythrough', () => setBgReady(true))
    audio.play().catch(() => {
      // autoplay blocked — user interaction needed
    })
  }, [])

  const toggleBackground = useCallback(() => {
    if (!bgRef.current) return
    if (bgEnabled) {
      bgRef.current.pause()
      setBgEnabled(false)
    } else {
      bgRef.current.play()
      setBgEnabled(true)
    }
  }, [bgEnabled])

  // Play voice at specific timestamp
  // voz.mp3: 0s = "Esperemos poder hacer algo contigo"
  // The second phrase starts at ~4s (adjust after testing actual audio)
  const playVoicePayment = useCallback(() => {
    const audio = new Audio('/audio/voice.mp3')
    audio.currentTime = 0
    audio.volume = 1
    voiceRef.current = audio
    audio.play().catch(() => {})
  }, [])

  const playVoiceDownload = useCallback(() => {
    // If both phrases are in one file, second starts ~4 seconds in
    // Adjust VOICE_DOWNLOAD_START to match your actual audio file timing
    const VOICE_DOWNLOAD_START = parseFloat(process.env.NEXT_PUBLIC_VOICE_DOWNLOAD_START || '4')
    const audio = new Audio('/audio/voice.mp3')
    audio.currentTime = VOICE_DOWNLOAD_START
    audio.volume = 1
    voiceRef.current = audio
    audio.play().catch(() => {})
  }, [])

  return {
    initBackground,
    toggleBackground,
    bgEnabled,
    playVoicePayment,
    playVoiceDownload,
  }
}
