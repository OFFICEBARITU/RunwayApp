'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  t: Record<string, string | string[]>
  product: 'analysis' | 'poster'
  price: string
  checkoutUrl: string
  onSuccess: (txId: string) => void
  onClose: () => void
}

export default function PaymentModal({ t, product, price, checkoutUrl, onSuccess, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'processing'>('idle')
  const [iframeUrl, setIframeUrl] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const firedRef = useRef(false)
  const API = process.env.NEXT_PUBLIC_API_URL || ''

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPolling = (sessionId: string) => {
    firedRef.current = false
    pollRef.current = setInterval(async () => {
      if (firedRef.current) { stopPolling(); return }
      try {
        const res = await fetch(`${API}/api/payment-status?session=${sessionId}`)
        if (!res.ok) return
        const data = await res.json()
        if ((data.validated || data.processing) && !firedRef.current) {
          firedRef.current = true
          stopPolling()
          setStatus('processing')
          const effectiveId = data.orderId || sessionId
          setTimeout(() => onSuccess(effectiveId), 50)
        }
      } catch {}
    }, 3000)
    setTimeout(() => stopPolling(), 600000)
  }

  useEffect(() => { return () => stopPolling() }, [])

  const handlePayClick = () => {
    const sessionId = 'ls_' + Date.now()
    setStatus('waiting')
    startPolling(sessionId)
    const url = `${checkoutUrl}?checkout[custom][session_id]=${sessionId}&checkout[custom][product]=${product}`
    setIframeUrl(url)
  }

  const title = product === 'poster' ? String(t.prod2Title) : String(t.prod1Title)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(8px)' }}
      />

      {/* Main modal — centered, scrollable */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 51,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', overflowY: 'auto',
      }}>
        <div style={{
          background: '#0f0f0f', border: '1px solid rgba(245,240,232,0.12)',
          padding: '32px 24px 32px', width: '100%', maxWidth: '380px',
          position: 'relative', borderRadius: '2px', flexShrink: 0,
        }}>
          {/* Close */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: '14px', right: '18px', background: 'none', border: 'none', color: 'rgba(245,240,232,0.35)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
          >×</button>

          <div style={{ width: '28px', height: '1px', background: '#C0001A', marginBottom: '18px' }} />
          <p style={{ fontSize: '7px', letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '8px' }}>{String(t.modalEyebrow)}</p>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 300, color: '#F5F0E8', marginBottom: '4px' }}>{title}</h2>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: '#F5F0E8', lineHeight: 1.1, marginBottom: '4px' }}>{price}</p>
          <p style={{ fontSize: '7.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.2)', marginBottom: '24px' }}>{String(t.modalNote)}</p>

          {status === 'processing' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '28px', height: '28px', border: '1px solid #C0001A', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(245,240,232,0.5)' }}>{String(t.processing)}</p>
            </div>
          ) : status === 'waiting' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: '28px', height: '28px', border: '1px solid rgba(245,240,232,0.2)', borderTopColor: '#C0001A', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(245,240,232,0.5)', marginBottom: '8px' }}>Waiting for payment...</p>
              <p style={{ fontSize: '8px', color: 'rgba(245,240,232,0.25)', letterSpacing: '0.05em' }}>Complete your payment in the window below.</p>
            </div>
          ) : (
            <>
              <button
                onClick={handlePayClick}
                style={{ width: '100%', padding: '14px', fontSize: '11px', marginBottom: '10px', cursor: 'pointer', fontWeight: 300, letterSpacing: '0.1em', background: '#fff', color: '#000', border: 'none' }}
              >
                {String(t.applePay)}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(245,240,232,0.08)' }} />
                <span style={{ fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(245,240,232,0.2)', textTransform: 'uppercase' }}>{String(t.orDivider)}</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(245,240,232,0.08)' }} />
              </div>
              <button
                onClick={handlePayClick}
                style={{ width: '100%', padding: '14px', fontSize: '11px', marginTop: '4px', cursor: 'pointer', fontWeight: 300, letterSpacing: '0.1em', background: 'transparent', color: 'rgba(245,240,232,0.6)', border: '0.5px solid rgba(245,240,232,0.18)' }}
              >
                {String(t.googlePay)}
              </button>
            </>
          )}

          <p style={{ fontSize: '7px', color: 'rgba(245,240,232,0.15)', textAlign: 'center', marginTop: '18px', letterSpacing: '0.08em' }}>
            🔒 Secured by Lemon Squeezy · Encrypted payment
          </p>
        </div>
      </div>

      {/* Iframe overlay — opens on top when payment clicked */}
      {iframeUrl && status !== 'processing' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', background: 'rgba(0,0,0,0.75)',
        }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '460px', height: '82vh', background: '#fff', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <button
              onClick={() => { setIframeUrl(''); setStatus('idle') }}
              style={{ position: 'absolute', top: '10px', right: '12px', zIndex: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            >×</button>
            <iframe
              src={iframeUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="payment"
            />
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
