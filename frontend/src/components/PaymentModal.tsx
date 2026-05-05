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

declare global {
  interface Window { paypal?: any }
}

export default function PaymentModal({ t, product, price, onSuccess, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'processing'>('idle')
  const [error, setError] = useState('')
  const [sdkReady, setSdkReady] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const firedRef = useRef(false)
  const sessionId = useRef('ls_' + Date.now())
  const API = process.env.NEXT_PUBLIC_API_URL || ''
  const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPolling = (sid: string) => {
    firedRef.current = false
    pollRef.current = setInterval(async () => {
      if (firedRef.current) { stopPolling(); return }
      try {
        const res = await fetch(`${API}/api/payment-status?session=${sid}`)
        if (!res.ok) return
        const data = await res.json()
        if ((data.validated || data.processing) && !firedRef.current) {
          firedRef.current = true
          stopPolling()
          setStatus('processing')
          const effectiveId = data.orderId || sid
          setTimeout(() => onSuccess(effectiveId), 50)
        }
      } catch {}
    }, 3000)
    setTimeout(() => stopPolling(), 600000)
  }

  // Load PayPal SDK
  useEffect(() => {
    if (window.paypal) { setSdkReady(true); return }
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD&intent=capture&components=buttons`
    script.onload = () => setSdkReady(true)
    script.onerror = () => setError('Failed to load PayPal')
    document.body.appendChild(script)
    return () => { stopPolling() }
  }, [])

  // Render PayPal buttons
  useEffect(() => {
    if (!sdkReady || !window.paypal || status !== 'idle') return
    const container = document.getElementById('paypal-buttons')
    if (!container || container.children.length > 0) return

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'black',
        shape: 'rect',
        label: 'pay',
        height: 48,
      },
      createOrder: async () => {
        const res = await fetch(`${API}/api/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product,
            sessionId: sessionId.current,
            amount: '2.99',
          }),
        })
        const data = await res.json()
        if (!data.id) throw new Error('Order creation failed')
        return data.id
      },
      onApprove: async (data: any) => {
        setStatus('waiting')
        startPolling(sessionId.current)
        const res = await fetch(`${API}/api/capture-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID: data.orderID, sessionId: sessionId.current, product }),
        })
        const capture = await res.json()
        if (capture.status === 'COMPLETED') {
          if (!firedRef.current) {
            firedRef.current = true
            stopPolling()
            setStatus('processing')
            setTimeout(() => onSuccess(sessionId.current), 50)
          }
        }
      },
      onError: (err: any) => {
        console.error('PayPal error:', err)
        setError('Payment failed. Please try again.')
      },
      onCancel: () => {
        setStatus('idle')
      },
    }).render('#paypal-buttons')
  }, [sdkReady, status])

  const title = product === 'poster' ? String(t.prod2Title) : String(t.prod1Title)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#0f0f0f', border: '1px solid rgba(245,240,232,0.12)', padding: '32px 24px', width: '100%', maxWidth: '380px', position: 'relative', borderRadius: '2px' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '18px', background: 'none', border: 'none', color: 'rgba(245,240,232,0.35)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>

          <div style={{ width: '28px', height: '1px', background: '#C0001A', marginBottom: '16px' }} />
          <p style={{ fontSize: '7px', letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '8px' }}>Secure Payment</p>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 300, color: '#F5F0E8', marginBottom: '4px' }}>{title}</h2>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: '#F5F0E8', lineHeight: 1.1, marginBottom: '20px' }}>USD 2.99</p>

          {status === 'processing' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '28px', height: '28px', border: '1px solid #C0001A', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(245,240,232,0.5)' }}>Processing...</p>
            </div>
          )}

          {status === 'waiting' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: '28px', height: '28px', border: '1px solid rgba(245,240,232,0.2)', borderTopColor: '#C0001A', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '9px', color: 'rgba(245,240,232,0.4)' }}>Confirming payment...</p>
            </div>
          )}

          {status === 'idle' && (
            <>
              {!sdkReady && <p style={{ fontSize: '9px', color: 'rgba(245,240,232,0.3)', textAlign: 'center', padding: '12px 0' }}>Loading payment options...</p>}
              <div id="paypal-buttons" />
              {error && <p style={{ fontSize: '9px', color: '#C0001A', textAlign: 'center', marginTop: '8px' }}>{error}</p>}
            </>
          )}

          <p style={{ fontSize: '7px', color: 'rgba(245,240,232,0.15)', textAlign: 'center', marginTop: '16px', letterSpacing: '0.08em' }}>
            🔒 Apple Pay · Google Pay · Credit Card · PayPal
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
