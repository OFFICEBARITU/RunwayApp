'use client'
import { useEffect, useState } from 'react'

interface Props {
  t: Record<string, string | string[]>
  onDownload: () => void
}

export default function ResultScreen({ t, onDownload }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: '#080808',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/images/heel-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.07,
          filter: 'blur(2px)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px', width: '100%', maxWidth: '400px' }}>
        {/* Check mark */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '1px solid rgba(245,240,232,0.15)',
              borderRadius: '50%',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            ✓
          </div>
        </div>

        <p style={{ fontSize: '7px', letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '10px' }}>
          {String(t.paymentSuccess)}
        </p>

        <h2
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontSize: '36px',
            fontStyle: 'italic',
            fontWeight: 300,
            color: 'var(--cream)',
            lineHeight: 1.1,
            marginBottom: '8px',
          }}
        >
          Your report<br />is ready.
        </h2>

        <div style={{ width: '32px', height: '1px', background: 'var(--rouge)', margin: '20px auto 28px' }} />

        <button
          onClick={onDownload}
          style={{
            background: 'var(--cream)',
            color: 'var(--noir)',
            border: 'none',
            padding: '16px 32px',
            width: '100%',
            fontFamily: 'var(--font-montserrat)',
            fontSize: '9px',
            fontWeight: 300,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            marginBottom: '10px',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--rouge)', e.currentTarget.style.color = 'var(--cream)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--cream)', e.currentTarget.style.color = 'var(--noir)')}
        >
          {String(t.downloadBtn)}
        </button>

        <p style={{ fontSize: '7.5px', letterSpacing: '0.2em', color: 'rgba(245,240,232,0.2)', textTransform: 'uppercase' }}>
          {String(t.downloadHint)}
        </p>
      </div>
    </div>
  )
}
