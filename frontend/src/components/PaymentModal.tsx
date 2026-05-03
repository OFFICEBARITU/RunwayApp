'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  t: Record<string, string | string[]>
  onSuccess: (txId: string) => void
  onClose: () => void
}

export default function PaymentModal({ t, onSuccess, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'processing'>('idle')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const sessionRef = useRef<string>('')
  const firedRef = useRef(false)

  const CHECKOUT_URL = process.env.NEXT_PUBLIC_LS_CHECKOUT_URL || ''
  const API = process.env.NEXT_PUBLIC_API_URL || ''

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPolling = (sessionId: string) => {
    sessionRef.current = sessionId
    firedRef.current = false
    pollRef.current = setInterval(async () => {
      if (firedRef.current) { stopPolling(); return }
      try {
        const res = await fetch(`${API}/api/payment-status?session=${sessionId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.validated && !firedRef.current) {
          firedRef.current = true
          stopPolling()
          setStatus('processing')
          setTimeout(() => onSuccess(sessionId), 50)
        }
      } catch {}
    }, 3000)
    setTimeout(() => stopPolling(), 600000)
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const handlePayClick = () => {
    const sessionId = 'ls_' + Date.now()
    setStatus('waiting')
    startPolling(sessionId)
    const url = `${CHECKOUT_URL}?checkout[custom][session_id]=${sessionId}`
    window.open(url, '_blank', 'width=500,height=700')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: 'rgba(8,8,8,0.92)',
        backgroundImage: 'url(/images/heel-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,8,0.90)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        background: '#0f0f0f',
        border: '1px solid rgba(245,240,232,0.12)',
        padding: '36px 28px 40px',
        width: '100%',
        maxWidth: '440px',
        borderBottom: 'none',
        position: 'relative',
        zIndex: 1,
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', color: 'rgba(245,240,232,0.3)', fontSize: '18px', cursor: 'pointer' }}>×</button>
        <div style={{ width: '32px', height: '1px', background: '#C0001A', marginBottom: '20px' }} />
        <p style={{ fontSize: '7px', letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '10px' }}>{String(t.modalEyebrow)}</p>
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontStyle: 'italic', fontWeight: 300, color: '#F5F0E8', marginBottom: '4px' }}>{String(t.modalTitle)}</h2>
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '40px', fontWeight: 300, color: '#F5F0E8', lineHeight: 1.1, marginBottom: '4px' }}>{String(t.modalAmount)}</p>
        <p style={{ fontSize: '8px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.25)', marginBottom: '28px' }}>{String(t.modalNote)}</p>

        {status === 'processing' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '1px solid #C0001A', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(245,240,232,0.5)' }}>{String(t.processing)}</p>
          </div>
        ) : status === 'waiting' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '1px solid rgba(245,240,232,0.3)', borderTopColor: '#C0001A', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(245,240,232,0.5)', marginBottom: '16px' }}>Waiting for payment confirmation...</p>
            <p style={{ fontSize: '8px', color: 'rgba(245,240,232,0.3)', letterSpacing: '0.1em' }}>Complete your payment in the new window.<br/>This page will update automatically.</p>
          </div>
        ) : (
          <>
            <button onClick={handlePayClick} style={{ width: '100%', padding: '14px', fontSize: '11px', marginBottom: '10px', cursor: 'pointer', fontWeight: 300, letterSpacing: '0.1em', background: '#fff', color: '#000', border: 'none' }}>
              {String(t.applePay)}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(245,240,232,0.08)' }} />
              <span style={{ fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(245,240,232,0.2)', textTransform: 'uppercase' }}>{String(t.orDivider)}</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(245,240,232,0.08)' }} />
            </div>
            <button onClick={handlePayClick} style={{ width: '100%', padding: '14px', fontSize: '11px', marginTop: '4px', cursor: 'pointer', fontWeight: 300, letterSpacing: '0.1em', background: 'transparent', color: 'rgba(245,240,232,0.6)', border: '0.5px solid rgba(245,240,232,0.18)' }}>
              {String(t.googlePay)}
            </button>
          </>
        )}
        <p style={{ fontSize: '7px', color: 'rgba(245,240,232,0.15)', textAlign: 'center', marginTop: '20px', letterSpacing: '0.08em' }}>🔒 Secured by Lemon Squeezy · Encrypted payment</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
