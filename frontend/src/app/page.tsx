'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { translations, Lang } from '@/lib/i18n'
import { useAudio } from '@/lib/useAudio'
import PaymentModal from '@/components/PaymentModal'
import AnalysisLoader from '@/components/AnalysisLoader'
import ResultScreen from '@/components/ResultScreen'
import AudioToggle from '@/components/AudioToggle'

type AppState = 'landing' | 'payment' | 'analyzing' | 'result'

export default function Home() {
  const [lang, setLang] = useState<Lang>('en')
  const [appState, setAppState] = useState<AppState>('landing')
  const [images, setImages] = useState<(File | null)[]>([null, null, null])
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null])
  const [error, setError] = useState('')
  const [reportUrl, setReportUrl] = useState('')
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState('')
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const t = translations[lang]
  const audio = useAudio()

  useEffect(() => {
    // Init background music on first interaction
    const handler = () => { audio.initBackground() }
    document.addEventListener('click', handler, { once: true })
    return () => document.removeEventListener('click', handler)
  }, [audio])

  const handleImageUpload = useCallback((index: number, file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setImages(prev => { const n = [...prev]; n[index] = file; return n })
      setPreviews(prev => { const n = [...prev]; n[index] = reader.result as string; return n })
    }
    reader.readAsDataURL(file)
  }, [])

  const handleCTA = useCallback(() => {
    if (!images[0] || !images[1] || !images[2]) {
      setError(String(t.errorUpload))
      setTimeout(() => setError(''), 3000)
      return
    }
    setError('')
    setAppState('payment')
  }, [images, t.errorUpload])

  const handlePaymentSuccess = useCallback(async (txId: string) => {
    setSessionId(txId)
    setAppState('analyzing')
    audio.playVoicePayment()

    // Send images to backend
    try {
      const formData = new FormData()
      images.forEach((img, i) => { if (img) formData.append(`image${i}`, img) })
      formData.append('transactionId', txId)
      formData.append('lang', lang)

      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Analysis failed')
      const data = await res.json()
      setReportUrl(data.reportUrl)
      setPosterUrl(data.posterUrl || null)
      setAppState('result')
    } catch {
      setError(String(t.errorPayment))
      setAppState('landing')
    }
  }, [images, lang, audio, t.errorPayment])

  const handleDownload = useCallback(() => {
    audio.playVoiceDownload()
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    window.open(`${API}${reportUrl}`, '_blank')
  }, [reportUrl, audio])

  const allUploaded = images.every(Boolean)

  return (
    <main className="min-h-screen bg-noir text-cream" style={{ fontFamily: 'var(--font-montserrat)' }}>
      {/* Background heel image */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/images/heel-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          opacity: 0.13,
          filter: 'blur(3px)',
        }}
      />
      {/* Dark overlay for legibility */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'rgba(8,8,8,0.82)' }}
      />

      {/* Language Selector */}
      <nav className="relative z-10 px-6 py-4 border-b border-white/5">
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '32px', fontWeight: 300, letterSpacing: '0.55em', textTransform: 'uppercase' }}>
            {String(t.brand)}
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          {(['en', 'es', 'pt', 'fr'] as Lang[]).map(l => (
            <button
              key={l}
              className={`lang-btn ${lang === l ? 'active' : ''}`}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-12 pb-8">
        <div className="max-w-md mx-auto">
          {/* Rouge line */}
          <div className="line-editorial mb-5" />

          <p className="animate-fadeInUp" style={{ fontSize: '9px', letterSpacing: '0.45em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.4)', marginBottom: '14px' }}>
            Colorimetry · Morphology · Style
          </p>

          <h1
            className="animate-fadeInUp delay-100"
            style={{ fontFamily: 'var(--font-cormorant)', fontSize: '42px', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.08, marginBottom: '12px' }}
          >
            {String(t.tagline)}
          </h1>

          <p
            className="animate-fadeInUp delay-200"
            style={{ fontSize: '11px', fontWeight: 200, letterSpacing: '0.06em', color: 'rgba(245,240,232,0.5)', lineHeight: 1.8, marginBottom: '36px', whiteSpace: 'pre-line' }}
          >
            {String(t.subtitle)}
          </p>

          {/* Upload Zone */}
          <div
            className="animate-fadeInUp delay-300"
            style={{ border: '1px solid rgba(245,240,232,0.1)', padding: '20px', marginBottom: '16px' }}
          >
            <p style={{ fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '14px' }}>
              {String(t.uploadTitle)}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {[t.slot1, t.slot2, t.slot3].map((label, i) => (
                <div key={i}>
                  <input
                    ref={fileRefs[i]}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && handleImageUpload(i, e.target.files[0])}
                  />
                  <div
                    className={`upload-slot ${previews[i] ? 'filled' : ''}`}
                    style={{ height: '90px', cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => fileRefs[i].current?.click()}
                  >
                    {previews[i] ? (
                      <img src={previews[i]!} alt={String(label)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', color: 'rgba(245,240,232,0.15)', marginBottom: '4px' }}>+</div>
                        <div style={{ fontSize: '7px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.2)' }}>{label}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '7.5px', letterSpacing: '0.08em', color: 'rgba(245,240,232,0.2)', textAlign: 'center' }}>
              {String(t.uploadHint)}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: '9px', color: 'var(--rouge)', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '10px' }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            className="animate-fadeInUp delay-400 cta-primary"
            onClick={handleCTA}
            disabled={!allUploaded}
          >
            {String(t.ctaButton)}
          </button>

          <p style={{ fontSize: '7px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.2)', textAlign: 'center', marginTop: '10px' }}>
            {String(t.ctaSubtext)}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-0 pb-16" style={{ borderTop: '1px solid rgba(245,240,232,0.06)', marginTop: '24px' }}>
        <div className="max-w-md mx-auto">
          {[
            { num: '01', title: t.feat1Title, desc: t.feat1Desc },
            { num: '02', title: t.feat2Title, desc: t.feat2Desc },
            { num: '03', title: t.feat3Title, desc: t.feat3Desc },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(245,240,232,0.06)',
                display: 'grid',
                gridTemplateColumns: '32px 1fr',
                gap: '12px',
                alignItems: 'start',
              }}
            >
              <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '11px', color: 'rgba(245,240,232,0.2)', letterSpacing: '0.1em', paddingTop: '2px' }}>{f.num}</span>
              <div>
                <p style={{ fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase', color: 'var(--cream)', marginBottom: '5px' }}>{f.title}</p>
                <p style={{ fontSize: '10.5px', color: 'rgba(245,240,232,0.4)', lineHeight: 1.7, fontWeight: 200 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 text-center" style={{ borderTop: '1px solid rgba(245,240,232,0.06)' }}>
        <p style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'rgba(245,240,232,0.2)', lineHeight: 1.8 }}>{String(t.footerText)}</p>
        <p style={{ fontSize: '7px', letterSpacing: '0.15em', color: 'rgba(245,240,232,0.12)', marginTop: '6px' }}>
          © {new Date().getFullYear()} Runway · {String(t.footerRights)}
        </p>
        <p style={{ fontSize: '7px', color: 'rgba(245,240,232,0.15)', marginTop: '6px', letterSpacing: '0.05em' }}>{String(t.privacyNote)}</p>
      </footer>

      {/* Overlays */}
      {appState === 'payment' && (
        <PaymentModal
          t={t}
          onSuccess={handlePaymentSuccess}
          onClose={() => setAppState('landing')}
        />
      )}

      {appState === 'analyzing' && (
        <AnalysisLoader t={t} />
      )}

      {appState === 'result' && (
        <ResultScreen t={t} onDownload={handleDownload} posterUrl={posterUrl} />
      )}

      <AudioToggle t={t} enabled={audio.bgEnabled} onToggle={audio.toggleBackground} />
    </main>
  )
}
