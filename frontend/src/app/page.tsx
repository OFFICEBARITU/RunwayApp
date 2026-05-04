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
      const maxAttempts = 72 // 6 min max
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
    <main style={{ minHeight: '100vh', background: '#FAFAF8', color: '#111', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header — Magazine style */}
      <header style={{ borderBottom: '3px solid #C0001A', background: '#fff', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 8px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111' }}>
              RUNWAY
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {(['en', 'es', 'pt', 'fr'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  fontSize: '9px', letterSpacing: '0.15em', fontWeight: lang === l ? 700 : 400,
                  color: lang === l ? '#C0001A' : '#888', background: 'none', border: 'none',
                  cursor: 'pointer', textTransform: 'uppercase', padding: '2px 0',
                  borderBottom: lang === l ? '1px solid #C0001A' : 'none'
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#888', paddingBottom: '8px', textAlign: 'center' }}>
            Personal Image Analysis · AI Editorial
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: '#111', color: '#fff', padding: '32px 20px 28px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '8px', letterSpacing: '0.5em', textTransform: 'uppercase', color: '#C0001A', marginBottom: '8px', fontWeight: 600 }}>
                MAY ISSUE
              </div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '36px', fontWeight: 700, lineHeight: 1.05, marginBottom: '12px', letterSpacing: '-0.01em' }}>
                {String(t.tagline)}
              </h1>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-line' }}>
                {String(t.subtitle)}
              </p>
            </div>
            <div style={{ width: '80px', flexShrink: 0 }}>
              <div style={{ width: '80px', height: '100px', background: '#C0001A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '8px', letterSpacing: '0.2em', color: '#fff', textTransform: 'uppercase', textAlign: 'center', padding: '8px', lineHeight: 1.6 }}>THE DEVIL WEARS PRADA</span>
              </div>
              <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', letterSpacing: '0.15em', textAlign: 'center' }}>IN THEATERS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Product selector — magazine style */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ height: '1px', flex: 1, background: '#ddd' }} />
            <span style={{ fontSize: '7px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#999' }}>{String(t.selectProduct)}</span>
            <div style={{ height: '1px', flex: 1, background: '#ddd' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Product 1 — Analysis */}
            <div onClick={() => handleSelectProduct('analysis')} style={{
              border: `2px solid ${product === 'analysis' ? '#C0001A' : '#e5e5e5'}`,
              cursor: 'pointer', transition: 'all 0.15s',
              background: product === 'analysis' ? '#fff8f8' : '#fff',
              position: 'relative',
            }}>
              <div style={{ background: product === 'analysis' ? '#C0001A' : '#111', padding: '12px', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'italic', color: '#fff', lineHeight: 1.2 }}>Editorial<br/>Report</div>
                  <div style={{ fontSize: '7px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>6 PAGES · PDF</div>
                </div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700, color: product === 'analysis' ? '#C0001A' : '#333', marginBottom: '3px' }}>{String(t.prod1Title)}</div>
                <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.5, marginBottom: '6px' }}>{String(t.prod1Desc)}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#111' }}>USD 2.99</div>
              </div>
              {product === 'analysis' && <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#C0001A', color: '#fff', fontSize: '8px', padding: '2px 5px', letterSpacing: '0.1em' }}>✓</div>}
            </div>

            {/* Product 2 — Poster */}
            <div onClick={() => handleSelectProduct('poster')} style={{
              border: `2px solid ${product === 'poster' ? '#C0001A' : '#e5e5e5'}`,
              cursor: 'pointer', transition: 'all 0.15s',
              background: product === 'poster' ? '#fff8f8' : '#fff',
              position: 'relative',
            }}>
              <div style={{ background: product === 'poster' ? '#C0001A' : '#111', padding: '12px', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'italic', color: '#fff', lineHeight: 1.2 }}>The Devil<br/>Wears Prada</div>
                  <div style={{ fontSize: '7px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>MOVIE POSTER · PNG</div>
                </div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700, color: product === 'poster' ? '#C0001A' : '#333', marginBottom: '3px' }}>{String(t.prod2Title)}</div>
                <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.5, marginBottom: '6px' }}>{String(t.prod2Desc)}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#111' }}>USD 2.99</div>
              </div>
              {product === 'poster' && <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#C0001A', color: '#fff', fontSize: '8px', padding: '2px 5px', letterSpacing: '0.1em' }}>✓</div>}
            </div>
          </div>
        </div>

        {/* Upload zone */}
        <div style={{ border: '1px solid #e5e5e5', marginBottom: '16px', background: '#fff' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: '#C0001A' }} />
            <span style={{ fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase', color: '#333', fontWeight: 600 }}>{String(t.uploadTitle)}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
          <div
            onClick={() => fileRef.current?.click()}
            style={{ height: '180px', cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: preview ? '#000' : '#FAFAF8' }}
          >
            {preview ? (
              <img src={preview} alt="Upload" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '32px', color: '#ddd', marginBottom: '8px' }}>+</div>
                <div style={{ fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#bbb', marginBottom: '4px' }}>
                  {product === 'poster' ? String(t.slotPoster) : String(t.slotAnalysis)}
                </div>
                <div style={{ fontSize: '8px', color: '#ccc' }}>JPG · PNG · Max 10MB</div>
              </div>
            )}
          </div>
        </div>

        {error && <p style={{ fontSize: '9px', color: '#C0001A', textAlign: 'center', marginBottom: '10px', letterSpacing: '0.05em' }}>{error}</p>}

        {/* CTA */}
        <button
          onClick={handleCTA}
          disabled={!image}
          style={{
            width: '100%', padding: '16px', background: image ? '#C0001A' : '#ddd',
            color: image ? '#fff' : '#999', border: 'none', cursor: image ? 'pointer' : 'not-allowed',
            fontFamily: 'Georgia, serif', fontSize: '14px', letterSpacing: '0.15em', textTransform: 'uppercase',
            fontWeight: 700, transition: 'background 0.2s', marginBottom: '8px',
          }}
        >
          {String(t.ctaButton)}
        </button>
        <p style={{ fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#aaa', textAlign: 'center' }}>
          Secure payment · {price} · One-time
        </p>

        {/* Features */}
        <div style={{ marginTop: '32px', borderTop: '1px solid #e5e5e5', paddingTop: '24px' }}>
          {[
            { num: '01', title: t.feat1Title, desc: t.feat1Desc },
            { num: '02', title: t.feat2Title, desc: t.feat2Desc },
            { num: '03', title: t.feat3Title, desc: t.feat3Desc },
          ].map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '10px', padding: '14px 0', borderBottom: i < 2 ? '1px solid #f0f0f0' : 'none' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: '10px', color: '#C0001A', fontWeight: 700, paddingTop: '2px' }}>{f.num}</span>
              <div>
                <p style={{ fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700, color: '#111', marginBottom: '4px' }}>{f.title}</p>
                <p style={{ fontSize: '10px', color: '#666', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ background: '#111', color: '#fff', padding: '24px 20px', marginTop: '32px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>RUNWAY</div>
        <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', marginBottom: '4px' }}>{String(t.footerText)}</p>
        <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Runway · {String(t.footerRights)}</p>
        <p style={{ fontSize: '7px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>{String(t.privacyNote)}</p>
      </footer>

      {appState === 'payment' && (
        <PaymentModal t={t} product={product} price={price} checkoutUrl={checkoutUrl} onSuccess={handlePaymentSuccess} onClose={() => setAppState('landing')} />
      )}
      {appState === 'analyzing' && <AnalysisLoader t={t} product={product} />}
      {appState === 'result' && <ResultScreen t={t} product={product} onDownload={handleDownload} />}
      <AudioToggle t={t} enabled={audio.bgEnabled} onToggle={audio.toggleBackground} />
    </main>
  )
}
