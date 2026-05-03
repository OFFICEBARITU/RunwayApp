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
    reader.onloadend = () => {
      setImage(file)
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSelectProduct = useCallback((p: ProductType) => {
    setProduct(p)
    setImage(null)
    setPreview(null)
    setError('')
  }, [])

  const handleCTA = useCallback(() => {
    if (!image) {
      setError(String(t.errorUpload1))
      setTimeout(() => setError(''), 3000)
      return
    }
    setError('')
    setAppState('payment')
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

      // Submit job — backend responds immediately with jobId
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Processing failed')
      const data = await res.json()

      if (!data.jobId) throw new Error('No job ID returned')

      // Poll for job completion
      const jobId = data.jobId
      let attempts = 0
      const maxAttempts = 60 // 5 min max (60 * 5s)

      const pollJob = async (): Promise<void> => {
        attempts++
        if (attempts > maxAttempts) throw new Error('Job timed out')

        const statusRes = await fetch(`${API}/api/job-status?id=${jobId}`)
        const status = await statusRes.json()

        if (status.status === 'done') {
          if (product === 'poster') {
            setPosterUrl(status.posterUrl || null)
            setReportUrl('')
          } else {
            setReportUrl(status.reportUrl || '')
            setPosterUrl(null)
          }
          setAppState('result')
          return
        }

        if (status.status === 'error') {
          throw new Error(status.error || 'Processing failed')
        }

        // Still processing — wait 5s and poll again
        await new Promise(r => setTimeout(r, 5000))
        return pollJob()
      }

      await pollJob()

    } catch {
      setError(String(t.errorPayment))
      setAppState('landing')
    }
  }, [image, lang, product, audio, t.errorPayment])

  const handleDownload = useCallback(() => {
    audio.playVoiceDownload()
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    if (product === 'poster' && posterUrl) {
      window.open(`${API}${posterUrl}`, '_blank')
    } else if (reportUrl) {
      window.open(`${API}${reportUrl}`, '_blank')
    }
  }, [reportUrl, posterUrl, product, audio])

  const checkoutUrl = process.env.NEXT_PUBLIC_LS_CHECKOUT_URL || ''

  const price = 'USD 2.99'

  return (
    <main className="min-h-screen bg-noir text-cream" style={{ fontFamily: 'var(--font-montserrat)' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'url(/images/heel-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center 40%', opacity: 0.13, filter: 'blur(3px)' }} />
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'rgba(8,8,8,0.82)' }} />

      {/* Header */}
      <nav className="relative z-10 px-6 py-4 border-b border-white/5">
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '32px', fontWeight: 300, letterSpacing: '0.55em', textTransform: 'uppercase' }}>
            {String(t.brand)}
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          {(['en', 'es', 'pt', 'fr'] as Lang[]).map(l => (
            <button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      <section className="relative z-10 px-6 pt-10 pb-8">
        <div className="max-w-md mx-auto">
          <div className="line-editorial mb-5" />
          <p className="animate-fadeInUp" style={{ fontSize: '9px', letterSpacing: '0.45em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.4)', marginBottom: '14px' }}>
            Colorimetry · Morphology · Style
          </p>
          <h1 className="animate-fadeInUp delay-100" style={{ fontFamily: 'var(--font-cormorant)', fontSize: '42px', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.08, marginBottom: '12px' }}>
            {String(t.tagline)}
          </h1>
          <p className="animate-fadeInUp delay-200" style={{ fontSize: '11px', fontWeight: 200, letterSpacing: '0.06em', color: 'rgba(245,240,232,0.5)', lineHeight: 1.8, marginBottom: '32px', whiteSpace: 'pre-line' }}>
            {String(t.subtitle)}
          </p>

          {/* Product Selector */}
          <div className="animate-fadeInUp delay-300" style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '14px', textAlign: 'center' }}>
              {String(t.selectProduct)}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Product 1 — Analysis */}
              <div
                onClick={() => handleSelectProduct('analysis')}
                style={{
                  border: `1px solid ${product === 'analysis' ? '#C0001A' : 'rgba(245,240,232,0.1)'}`,
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* PDF preview */}
                <div style={{ width: '100%', height: '120px', background: 'rgba(245,240,232,0.03)', marginBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,240,232,0.06)' }}>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '22px', fontStyle: 'italic', color: 'rgba(245,240,232,0.2)', textAlign: 'center', lineHeight: 1.2 }}>Editorial<br/>Report</div>
                  <div style={{ fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(245,240,232,0.1)', marginTop: '6px' }}>6 PAGES · PDF</div>
                </div>
                <p style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: product === 'analysis' ? '#C0001A' : 'rgba(245,240,232,0.6)', marginBottom: '4px' }}>
                  {String(t.prod1Title)}
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(245,240,232,0.4)', marginBottom: '6px', lineHeight: 1.5 }}>{String(t.prod1Desc)}</p>
                <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '20px', fontWeight: 300, color: 'var(--cream)' }}>USD 2.99</p>
                {product === 'analysis' && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', width: '6px', height: '6px', borderRadius: '50%', background: '#C0001A' }} />
                )}
              </div>

              {/* Product 2 — Poster */}
              <div
                onClick={() => handleSelectProduct('poster')}
                style={{
                  border: `1px solid ${product === 'poster' ? '#C0001A' : 'rgba(245,240,232,0.1)'}`,
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Poster preview */}
                <div style={{ width: '100%', height: '120px', background: 'rgba(245,240,232,0.03)', marginBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,240,232,0.06)' }}>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '22px', fontStyle: 'italic', color: 'rgba(245,240,232,0.2)', textAlign: 'center', lineHeight: 1.2 }}>The Devil<br/>Wears Prada</div>
                  <div style={{ fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(245,240,232,0.1)', marginTop: '6px' }}>POSTER · PNG</div>
                </div>
                <p style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: product === 'poster' ? '#C0001A' : 'rgba(245,240,232,0.6)', marginBottom: '4px' }}>
                  {String(t.prod2Title)}
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(245,240,232,0.4)', marginBottom: '6px', lineHeight: 1.5 }}>{String(t.prod2Desc)}</p>
                <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '20px', fontWeight: 300, color: 'var(--cream)' }}>USD 2.99</p>
                {product === 'poster' && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', width: '6px', height: '6px', borderRadius: '50%', background: '#C0001A' }} />
                )}
              </div>
            </div>
          </div>

          {/* Upload Zone — 1 image */}
          <div className="animate-fadeInUp delay-400" style={{ border: '1px solid rgba(245,240,232,0.1)', padding: '20px', marginBottom: '16px' }}>
            <p style={{ fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '14px' }}>
              {String(t.uploadTitle)}
            </p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
            <div
              className={`upload-slot ${preview ? 'filled' : ''}`}
              style={{ height: '200px', cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <img src={preview} alt="Upload" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', color: 'rgba(245,240,232,0.15)', marginBottom: '8px' }}>+</div>
                  <div style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '4px' }}>
                    {product === 'poster' ? String(t.slotPoster) : String(t.slotAnalysis)}
                  </div>
                  <div style={{ fontSize: '7px', color: 'rgba(245,240,232,0.2)', letterSpacing: '0.1em' }}>JPG · PNG · Max 10MB</div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p style={{ fontSize: '9px', color: 'var(--rouge)', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '10px' }}>{error}</p>
          )}

          <button className="animate-fadeInUp delay-400 cta-primary" onClick={handleCTA} disabled={!image}>
            {String(t.ctaButton)}
          </button>
          <p style={{ fontSize: '7px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.2)', textAlign: 'center', marginTop: '10px' }}>
            {`Secure payment · ${price} · One-time`}
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
            <div key={i} style={{ padding: '20px 24px', borderBottom: '1px solid rgba(245,240,232,0.06)', display: 'grid', gridTemplateColumns: '32px 1fr', gap: '12px', alignItems: 'start' }}>
              <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '11px', color: 'rgba(245,240,232,0.2)', letterSpacing: '0.1em', paddingTop: '2px' }}>{f.num}</span>
              <div>
                <p style={{ fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase', color: 'var(--cream)', marginBottom: '5px' }}>{f.title}</p>
                <p style={{ fontSize: '10.5px', color: 'rgba(245,240,232,0.4)', lineHeight: 1.7, fontWeight: 200 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 px-6 py-8 text-center" style={{ borderTop: '1px solid rgba(245,240,232,0.06)' }}>
        <p style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'rgba(245,240,232,0.2)', lineHeight: 1.8 }}>{String(t.footerText)}</p>
        <p style={{ fontSize: '7px', letterSpacing: '0.15em', color: 'rgba(245,240,232,0.12)', marginTop: '6px' }}>
          © {new Date().getFullYear()} Runway · {String(t.footerRights)}
        </p>
        <p style={{ fontSize: '7px', color: 'rgba(245,240,232,0.15)', marginTop: '6px', letterSpacing: '0.05em' }}>{String(t.privacyNote)}</p>
      </footer>

      {appState === 'payment' && (
        <PaymentModal
          t={t}
          product={product}
          price={price}
          checkoutUrl={checkoutUrl}
          onSuccess={handlePaymentSuccess}
          onClose={() => setAppState('landing')}
        />
      )}
      {appState === 'analyzing' && <AnalysisLoader t={t} product={product} />}
      {appState === 'result' && (
        <ResultScreen
          t={t}
          product={product}
          onDownload={handleDownload}
        />
      )}

      <AudioToggle t={t} enabled={audio.bgEnabled} onToggle={audio.toggleBackground} />
    </main>
  )
}
