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
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Helvetica Neue', Arial, sans-serif", position: 'relative', overflowX: 'hidden' }}>

      {/* Full-page blurred background cover */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'url(/images/runway-cover.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center top',
        filter: 'blur(18px) brightness(0.35) saturate(0.8)',
        transform: 'scale(1.08)',
      }} />
      {/* Gradient overlay for readability */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.3) 30%, rgba(10,10,10,0.75) 70%, rgba(10,10,10,0.95) 100%)',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <header style={{ padding: '0 20px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#fff' }}>
              RUNWAY
            </div>
            <div style={{ display: 'flex', gap: '14px' }}>
              {(['en', 'es', 'pt', 'fr'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  fontSize: '9px', letterSpacing: '0.15em', fontWeight: lang === l ? 700 : 400,
                  color: lang === l ? '#C0001A' : 'rgba(255,255,255,0.4)', background: 'none', border: 'none',
                  cursor: 'pointer', textTransform: 'uppercase', padding: '2px 0',
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* HERO — big magazine masthead */}
        <section style={{ padding: '48px 20px 40px', textAlign: 'center' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            {/* Eyebrow */}
            <div style={{ fontSize: '8px', letterSpacing: '0.55em', textTransform: 'uppercase', color: '#C0001A', marginBottom: '16px', fontWeight: 600 }}>
              The Devil Wears Prada · MAY ISSUE
            </div>

            {/* Giant RUNWAY logo */}
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(64px, 18vw, 96px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 0.9, color: '#fff', marginBottom: '8px', textShadow: '0 4px 40px rgba(192,0,26,0.4)' }}>
              RUNWAY
            </div>

            {/* Red separator */}
            <div style={{ width: '48px', height: '3px', background: '#C0001A', margin: '16px auto' }} />

            {/* Tagline */}
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 400, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, marginBottom: '12px' }}>
              {String(t.tagline)}
            </h1>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, fontWeight: 300, maxWidth: '340px', margin: '0 auto 32px', whiteSpace: 'pre-line' }}>
              {String(t.subtitle)}
            </p>

            {/* Social proof */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '8px' }}>
              {['AI Analysis', 'Editorial PDF', 'In minutes'].map((item, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main card */}
        <section style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px 40px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px' }}>

            {/* Product selector */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ fontSize: '7px', letterSpacing: '0.45em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: '14px' }}>
                {String(t.selectProduct)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                {/* Product 1 — Analysis */}
                <div onClick={() => handleSelectProduct('analysis')} style={{
                  border: `1.5px solid ${product === 'analysis' ? '#C0001A' : 'rgba(255,255,255,0.12)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: product === 'analysis' ? 'rgba(192,0,26,0.12)' : 'rgba(255,255,255,0.03)',
                  position: 'relative', padding: '16px 14px',
                }}>
                  {/* Icon area */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '36px', height: '44px', background: product === 'analysis' ? '#C0001A' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '16px' }}>📄</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '7px', letterSpacing: '0.3em', textTransform: 'uppercase', color: product === 'analysis' ? '#C0001A' : 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '2px' }}>
                        {String(t.prod1Title)}
                      </div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#fff' }}>2.99</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{String(t.prod1Desc)}</div>
                  <div style={{ marginTop: '8px', fontSize: '7px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>6 pages · PDF</div>
                  {product === 'analysis' && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#C0001A', color: '#fff', fontSize: '8px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✓</div>
                  )}
                </div>

                {/* Product 2 — Poster */}
                <div onClick={() => handleSelectProduct('poster')} style={{
                  border: `1.5px solid ${product === 'poster' ? '#C0001A' : 'rgba(255,255,255,0.12)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: product === 'poster' ? 'rgba(192,0,26,0.12)' : 'rgba(255,255,255,0.03)',
                  position: 'relative', padding: '16px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '36px', height: '44px', background: product === 'poster' ? '#C0001A' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '16px' }}>🎬</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '7px', letterSpacing: '0.3em', textTransform: 'uppercase', color: product === 'poster' ? '#C0001A' : 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '2px' }}>
                        {String(t.prod2Title)}
                      </div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#fff' }}>2.99</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{String(t.prod2Desc)}</div>
                  <div style={{ marginTop: '8px', fontSize: '7px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>AI generated · PNG</div>
                  {product === 'poster' && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#C0001A', color: '#fff', fontSize: '8px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✓</div>
                  )}
                </div>
              </div>
            </div>

            {/* Upload zone */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '2px', height: '12px', background: '#C0001A' }} />
                <span style={{ fontSize: '7px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{String(t.uploadTitle)}</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  height: '160px', cursor: 'pointer', border: `1.5px dashed ${preview ? '#C0001A' : 'rgba(255,255,255,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative', transition: 'border-color 0.2s',
                  background: preview ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                {preview ? (
                  <img src={preview} alt="Upload" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📸</div>
                    <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                      {product === 'poster' ? String(t.slotPoster) : String(t.slotAnalysis)}
                    </div>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)' }}>Tap to select · JPG PNG · Max 10MB</div>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && <p style={{ fontSize: '9px', color: '#C0001A', textAlign: 'center', padding: '0 20px 8px', letterSpacing: '0.05em' }}>{error}</p>}

            {/* CTA */}
            <div style={{ padding: '0 20px 20px' }}>
              <button
                onClick={handleCTA}
                disabled={!image}
                style={{
                  width: '100%', padding: '18px',
                  background: image ? 'linear-gradient(135deg, #C0001A 0%, #8B0000 100%)' : 'rgba(255,255,255,0.08)',
                  color: image ? '#fff' : 'rgba(255,255,255,0.3)',
                  border: 'none', cursor: image ? 'pointer' : 'not-allowed',
                  fontFamily: 'Georgia, serif', fontSize: '15px', letterSpacing: '0.2em',
                  textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.2s',
                  boxShadow: image ? '0 8px 32px rgba(192,0,26,0.4)' : 'none',
                }}
              >
                {String(t.ctaButton)} →
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '10px' }}>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>🔒 SECURE</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>USD 2.99</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>ONE-TIME</span>
              </div>
            </div>
          </div>

          {/* Features strip */}
          <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { icon: '⚡', title: 'Fast', desc: 'Results in minutes' },
              { icon: '🎨', title: 'Precise', desc: 'AI + Colorimetry' },
              { icon: '📱', title: 'Mobile', desc: 'PDF & PNG ready' },
            ].map((f, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{f.icon}</div>
                <div style={{ fontSize: '8px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fff', fontWeight: 700, marginBottom: '2px' }}>{f.title}</div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Editorial features */}
          <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { num: '01', title: t.feat1Title, desc: t.feat1Desc },
              { num: '02', title: t.feat2Title, desc: t.feat2Desc },
              { num: '03', title: t.feat3Title, desc: t.feat3Desc },
            ].map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '12px', padding: '16px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '11px', color: '#C0001A', fontWeight: 700 }}>{f.num}</span>
                <div>
                  <p style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{f.title}</p>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '24px 20px 40px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>RUNWAY</div>
          <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', marginBottom: '4px' }}>{String(t.footerText)}</p>
          <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.15)' }}>© {new Date().getFullYear()} Runway · {String(t.footerRights)}</p>
          <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.15)', marginTop: '4px' }}>{String(t.privacyNote)}</p>
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
