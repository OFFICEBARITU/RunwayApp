'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { translations, Lang } from '@/lib/i18n'
import { useAudio } from '@/lib/useAudio'
import PaymentModal from '@/components/PaymentModal'
import AnalysisLoader from '@/components/AnalysisLoader'
import ResultScreen from '@/components/ResultScreen'
import AudioToggle from '@/components/AudioToggle'

type AppState = 'landing' | 'payment' | 'analyzing' | 'result'
type ProductType = 'analysis' | 'poster'

// SVG icons — editorial, thin stroke, no emojis
const IconReport = () => (
  <svg width="22" height="28" viewBox="0 0 22 28" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="20" height="26" rx="0.5"/>
    <line x1="5" y1="8" x2="17" y2="8"/>
    <line x1="5" y1="12" x2="17" y2="12"/>
    <line x1="5" y1="16" x2="13" y2="16"/>
    <line x1="5" y1="20" x2="11" y2="20"/>
  </svg>
)

const IconPoster = () => (
  <svg width="22" height="28" viewBox="0 0 22 28" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="20" height="26" rx="0.5"/>
    <circle cx="11" cy="10" r="4"/>
    <path d="M1 20 Q6 15 11 18 Q16 21 21 16"/>
  </svg>
)

const IconUpload = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="26" height="26" rx="0.5"/>
    <circle cx="9" cy="10" r="2.5"/>
    <path d="M1 20 L8 14 L13 18 L18 12 L27 20"/>
    <line x1="14" y1="7" x2="14" y2="1"/>
    <polyline points="11,4 14,1 17,4"/>
  </svg>
)

const IconLock = () => (
  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="0.8">
    <rect x="1" y="5" width="8" height="7" rx="0.5"/>
    <path d="M3 5V3.5a2 2 0 014 0V5"/>
  </svg>
)

const IconSpeed = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
    <circle cx="9" cy="10" r="7"/>
    <path d="M9 10 L13 5"/>
    <line x1="2" y1="10" x2="0.5" y2="10"/>
    <line x1="9" y1="3" x2="9" y2="1.5"/>
    <line x1="14.5" y1="5.5" x2="15.5" y2="4.5"/>
  </svg>
)

const IconAI = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
    <polygon points="9,1 17,5.5 17,12.5 9,17 1,12.5 1,5.5"/>
    <circle cx="9" cy="9" r="2.5"/>
    <line x1="9" y1="1" x2="9" y2="6.5"/>
    <line x1="9" y1="11.5" x2="9" y2="17"/>
  </svg>
)

const IconPhone = () => (
  <svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
    <rect x="1" y="1" width="12" height="16" rx="1.5"/>
    <line x1="5.5" y1="14.5" x2="8.5" y2="14.5"/>
  </svg>
)

export default function Home() {
  const [lang, setLang] = useState<Lang>('en')
  const [appState, setAppState] = useState<AppState>('landing')
  const [product, setProduct] = useState<ProductType>('analysis')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [reportUrl, setReportUrl] = useState('')
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = translations[lang]
  const audio = useAudio()

  useEffect(() => {
    const handler = () => { audio.initBackground() }
    document.addEventListener('click', handler, { once: true })
    return () => document.removeEventListener('click', handler)
  }, [audio])

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onloadend = () => { setImage(file); setPreview(reader.result as string) }
    reader.readAsDataURL(file)
  }, [])

  const handleSelectProduct = useCallback((p: ProductType) => {
    setProduct(p); setImage(null); setPreview(null); setError('')
  }, [])

  const handleCTA = useCallback(() => {
    if (!image) { setError(String(t.errorUpload1)); setTimeout(() => setError(''), 3000); return }
    setError(''); setAppState('payment')
  }, [image, t.errorUpload1])

  const handlePaymentSuccess = useCallback(async (txId: string) => {
    setAppState('analyzing')
    audio.playVoicePayment()
    try {
      const formData = new FormData()
      if (image) formData.append('image0', image)
      formData.append('transactionId', txId)
      formData.append('lang', lang)
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const endpoint = product === 'poster' ? `${API}/api/poster` : `${API}/api/analyze`
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Processing failed')
      const data = await res.json()
      if (!data.jobId) throw new Error('No job ID returned')
      const jobId = data.jobId
      let attempts = 0
      const maxAttempts = 72
      const pollJob = async (): Promise<void> => {
        attempts++
        if (attempts > maxAttempts) throw new Error('Job timed out')
        const statusRes = await fetch(`${API}/api/job-status?id=${jobId}`)
        const status = await statusRes.json()
        if (status.status === 'done') {
          if (product === 'poster') { setPosterUrl(status.posterUrl || null); setReportUrl('') }
          else { setReportUrl(status.reportUrl || ''); setPosterUrl(null) }
          setAppState('result'); return
        }
        if (status.status === 'error') throw new Error(status.error || 'Processing failed')
        await new Promise(r => setTimeout(r, 5000))
        return pollJob()
      }
      await pollJob()
    } catch (err: any) {
      setError(String(t.errorPayment)); setAppState('landing')
    }
  }, [image, lang, product, audio, t.errorPayment])

  const handleDownload = useCallback(() => {
    audio.playVoiceDownload()
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    if (product === 'poster' && posterUrl) window.open(`${API}${posterUrl}`, '_blank')
    else if (reportUrl) window.open(`${API}${reportUrl}`, '_blank')
  }, [reportUrl, posterUrl, product, audio])

  const checkoutUrl = process.env.NEXT_PUBLIC_LS_CHECKOUT_URL || ''
  const price = 'USD 2.99'

  return (
    <main style={{ minHeight: '100vh', background: '#080808', color: '#fff', fontFamily: "'Cormorant Garamond', 'Times New Roman', Georgia, serif", position: 'relative', overflowX: 'hidden' }}>

      {/* ── BACKGROUND: cover photo blurred + heel silhouette ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        {/* Runway cover — deeply blurred */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/images/runway-cover.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center 20%',
          filter: 'blur(24px) brightness(0.22) saturate(0.6)',
          transform: 'scale(1.1)',
        }} />
        {/* Heel silhouette — subtle, bottom right */}
        <div style={{
          position: 'absolute', bottom: 0, right: '-20px',
          width: '45vw', maxWidth: '220px',
          backgroundImage: 'url(/images/heel-bg.png)',
          backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom right',
          opacity: 0.07, height: '60vh',
        }} />
        {/* Gradient vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(8,8,8,0.6) 0%, rgba(8,8,8,0.15) 25%, rgba(8,8,8,0.5) 65%, rgba(8,8,8,0.98) 100%)',
        }} />
        {/* Vertical red accent line — editorial detail */}
        <div style={{ position: 'absolute', top: 0, left: '20px', width: '1px', height: '100%', background: 'linear-gradient(180deg, transparent, rgba(192,0,26,0.3) 30%, rgba(192,0,26,0.15) 70%, transparent)', pointerEvents: 'none' }} />
      </div>

      {/* ── CONTENT ── */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <header style={{ padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,8,8,0.5)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '20px', fontWeight: 300, letterSpacing: '0.6em', textTransform: 'uppercase', color: '#fff' }}>
              RUNWAY
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              {(['en', 'es', 'pt', 'fr'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  fontSize: '8px', letterSpacing: '0.2em', fontWeight: lang === l ? 500 : 300,
                  color: lang === l ? '#C0001A' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none',
                  cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit',
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section style={{ padding: '56px 24px 44px', textAlign: 'center' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>

            {/* Issue label */}
            <div style={{ fontSize: '7px', letterSpacing: '0.6em', textTransform: 'uppercase', color: 'rgba(192,0,26,0.8)', marginBottom: '20px', fontWeight: 300, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
              The Devil Wears Prada · May Issue
            </div>

            {/* Magazine masthead — thin weight like the photo */}
            <div style={{
              fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
              fontSize: 'clamp(72px, 20vw, 108px)',
              fontWeight: 300,
              letterSpacing: '0.05em',
              lineHeight: 0.88,
              color: '#fff',
              marginBottom: '6px',
            }}>
              RUNWAY
            </div>

            {/* Thin red rule */}
            <div style={{ width: '40px', height: '1px', background: '#C0001A', margin: '20px auto' }} />

            {/* Tagline — italic serif, light */}
            <h1 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '20px', fontStyle: 'italic', fontWeight: 300,
              color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, marginBottom: '14px',
            }}>
              {String(t.tagline)}
            </h1>

            <p style={{
              fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.9,
              fontWeight: 300, maxWidth: '320px', margin: '0 auto 36px',
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              letterSpacing: '0.03em', whiteSpace: 'pre-line',
            }}>
              {String(t.subtitle)}
            </p>

            {/* Micro social proof */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
              {['AI Colorimetry', 'Editorial PDF', 'Instant Results'].map((item, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ width: '1px', height: '12px', background: 'rgba(192,0,26,0.5)', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '6.5px', letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MAIN CARD ── */}
        <section style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px 48px' }}>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(24px)' }}>

            {/* Product selector */}
            <div style={{ padding: '22px 20px 0' }}>
              <div style={{ fontSize: '6.5px', letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginBottom: '16px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                {String(t.selectProduct)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                {/* Product 1 — Analysis */}
                <div onClick={() => handleSelectProduct('analysis')} style={{
                  border: `1px solid ${product === 'analysis' ? '#C0001A' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', transition: 'border-color 0.2s',
                  background: product === 'analysis' ? 'rgba(192,0,26,0.06)' : 'transparent',
                  position: 'relative', padding: '16px 14px',
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ width: '44px', height: '54px', flexShrink: 0, overflow: 'hidden', marginTop: '2px' }}>
                      <svg width="44" height="54" viewBox="0 0 44 54" style={{ display: 'block' }}>
                        <rect width="44" height="54" fill="#0a0a0a"/>
                        <circle cx="22" cy="24" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
                        <path d="M22 10 A14 14 0 0 1 34.1 17" fill="none" stroke="#f5c842" strokeWidth="3.5" strokeLinecap="round"/>
                        <path d="M34.1 17 A14 14 0 0 1 34.1 31" fill="none" stroke="#e8834a" strokeWidth="3.5" strokeLinecap="round"/>
                        <path d="M34.1 31 A14 14 0 0 1 22 38" fill="none" stroke="#c0392b" strokeWidth="3.5" strokeLinecap="round"/>
                        <path d="M22 38 A14 14 0 0 1 9.9 31" fill="none" stroke="#8e44ad" strokeWidth="3.5" strokeLinecap="round"/>
                        <path d="M9.9 31 A14 14 0 0 1 9.9 17" fill="none" stroke="#3498db" strokeWidth="3.5" strokeLinecap="round"/>
                        <path d="M9.9 17 A14 14 0 0 1 22 10" fill="none" stroke="#27ae60" strokeWidth="3.5" strokeLinecap="round"/>
                        <circle cx="22" cy="24" r="6" fill="rgba(192,0,26,0.7)"/>
                        <circle cx="22" cy="24" r="2.5" fill="rgba(255,255,255,0.9)"/>
                        <text x="22" y="48" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.2)" fontFamily="Arial">COLORIMETRY</text>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '7px', letterSpacing: '0.35em', textTransform: 'uppercase', color: product === 'analysis' ? '#C0001A' : 'rgba(255,255,255,0.4)', fontWeight: 400, marginBottom: '4px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                        {String(t.prod1Title)}
                      </div>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 300, color: '#fff', lineHeight: 1 }}>
                        $2.99
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 300 }}>{String(t.prod1Desc)}</div>
                  <div style={{ marginTop: '10px', fontSize: '6.5px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>6 pages · PDF</div>
                  {product === 'analysis' && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#C0001A' }} />
                  )}
                </div>

                {/* Product 2 — Poster */}
                <div onClick={() => handleSelectProduct('poster')} style={{
                  border: `1px solid ${product === 'poster' ? '#C0001A' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', transition: 'border-color 0.2s',
                  background: product === 'poster' ? 'rgba(192,0,26,0.06)' : 'transparent',
                  position: 'relative', padding: '16px 14px',
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={ width: '44px', height: '54px', flexShrink: 0, overflow: 'hidden', marginTop: '2px', border: '1px solid rgba(255,255,255,0.1)' }>
                      <img
                        src="data:image/jpeg;base64,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"
                        alt="Runway Poster"
                        style={ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', filter: product === 'poster' ? 'none' : 'grayscale(60%) brightness(0.7)' }
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '7px', letterSpacing: '0.35em', textTransform: 'uppercase', color: product === 'poster' ? '#C0001A' : 'rgba(255,255,255,0.4)', fontWeight: 400, marginBottom: '4px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                        {String(t.prod2Title)}
                      </div>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 300, color: '#fff', lineHeight: 1 }}>
                        $2.99
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 300 }}>{String(t.prod2Desc)}</div>
                  <div style={{ marginTop: '10px', fontSize: '6.5px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>AI Generated · PNG</div>
                  {product === 'poster' && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#C0001A' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Upload */}
            <div style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '6.5px', letterSpacing: '0.45em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{String(t.uploadTitle)}</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  height: '154px', cursor: 'pointer',
                  border: `1px solid ${preview ? 'rgba(192,0,26,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', transition: 'border-color 0.2s',
                  background: preview ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}
              >
                {preview ? (
                  <img src={preview} alt="Upload" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                      <IconUpload />
                    </div>
                    <div style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '4px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                      {product === 'poster' ? String(t.slotPoster) : String(t.slotAnalysis)}
                    </div>
                    <div style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.15)', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                      JPG · PNG · Max 10MB
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && <p style={{ fontSize: '9px', color: '#C0001A', textAlign: 'center', padding: '0 20px 8px', letterSpacing: '0.05em', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{error}</p>}

            {/* CTA */}
            <div style={{ padding: '0 20px 22px' }}>
              <button
                onClick={handleCTA}
                disabled={!image}
                style={{
                  width: '100%', padding: '16px',
                  background: image ? '#C0001A' : 'rgba(255,255,255,0.05)',
                  color: image ? '#fff' : 'rgba(255,255,255,0.2)',
                  border: image ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  cursor: image ? 'pointer' : 'not-allowed',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '16px', fontStyle: 'italic', fontWeight: 300,
                  letterSpacing: '0.15em',
                  transition: 'all 0.2s',
                }}
              >
                {String(t.ctaButton)}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: 'rgba(255,255,255,0.2)' }}>
                <IconLock />
                <span style={{ fontSize: '7px', letterSpacing: '0.2em', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                  Secured · USD 2.99 · One-time payment
                </span>
              </div>
            </div>
          </div>

          {/* Features strip — thin elegant */}
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
            {[
              { icon: <IconSpeed />, label: 'Instant' },
              { icon: <IconAI />, label: 'AI Precision' },
              { icon: <IconPhone />, label: 'Mobile Ready' },
            ].map((f, i) => (
              <div key={i} style={{ background: 'rgba(8,8,8,0.8)', padding: '14px 10px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                <div style={{ color: 'rgba(255,255,255,0.25)', display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>{f.icon}</div>
                <div style={{ fontSize: '6.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{f.label}</div>
              </div>
            ))}
          </div>

          {/* Editorial features */}
          <div style={{ marginTop: '1px', background: 'rgba(8,8,8,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { num: '01', title: t.feat1Title, desc: t.feat1Desc },
              { num: '02', title: t.feat2Title, desc: t.feat2Desc },
              { num: '03', title: t.feat3Title, desc: t.feat3Desc },
            ].map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '12px', padding: '16px 20px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '11px', color: 'rgba(192,0,26,0.6)', fontWeight: 300, paddingTop: '1px' }}>{f.num}</span>
                <div>
                  <p style={{ fontSize: '7.5px', letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 400, marginBottom: '5px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{f.title}</p>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.75, fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 300 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '24px 20px 40px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '18px', fontWeight: 300, letterSpacing: '0.6em', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>RUNWAY</div>
          <p style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', marginBottom: '4px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{String(t.footerText)}</p>
          <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.1)', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>© {new Date().getFullYear()} Runway · {String(t.footerRights)}</p>
          <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.1)', marginTop: '4px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{String(t.privacyNote)}</p>
        </footer>
      </div>

      {appState === 'payment' && (
        <PaymentModal t={t} product={product} price={price} checkoutUrl={checkoutUrl} onSuccess={handlePaymentSuccess} onClose={() => setAppState('landing')} />
      )}
      {appState === 'analyzing' && <AnalysisLoader t={t} product={product} />}
      {appState === 'result' && <ResultScreen t={t} product={product} onDownload={handleDownload} />}
      <AudioToggle t={t} enabled={audio.bgEnabled} onToggle={audio.toggleBackground} />
    </main>
  )
}
