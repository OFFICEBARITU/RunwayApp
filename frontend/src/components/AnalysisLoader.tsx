'use client'
import { useEffect, useState } from 'react'

interface Props {
  t: Record<string, string | string[]>
}

export default function AnalysisLoader({ t }: Props) {
  const rawSteps = t.analysisSteps
  const steps: string[] = Array.isArray(rawSteps) ? rawSteps : []

  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const total = steps.length || 6
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev + 1
        if (next >= total) { clearInterval(interval); return prev }
        return next
      })
      setProgress(prev => Math.min(prev + (100 / total), 95))
    }, 4500)
    return () => clearInterval(interval)
  }, [steps.length])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: '#080808' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/images/heel-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center 40%', opacity: 0.13, filter: 'blur(3px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,8,0.82)' }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px', width: '100%', maxWidth: '400px' }}>
        <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '14px', letterSpacing: '0.6em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginBottom: '40px' }}>Runway</p>

        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '36px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: '2px', height: '32px', background: '#C0001A', opacity: 0.6, animation: `barPulse 1.2s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>

        <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '24px', fontStyle: 'italic', fontWeight: 300, color: '#F5F0E8', marginBottom: '8px' }}>
          {String(t.analyzing || 'Creating your editorial report...')}
        </h2>

        <p key={currentStep} style={{ fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.4)', marginBottom: '32px', animation: 'fadeIn 0.5s ease' }}>
          {steps[currentStep] || ''}
        </p>

        <div style={{ width: '100%', height: '1px', background: 'rgba(245,240,232,0.08)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '1px', background: '#C0001A', width: `${progress}%`, transition: 'width 4s ease' }} />
        </div>
        <p style={{ fontSize: '8px', color: 'rgba(245,240,232,0.2)', marginTop: '10px', letterSpacing: '0.1em' }}>{Math.round(progress)}%</p>
      </div>

      <style>{`
        @keyframes barPulse { 0%,100%{transform:scaleY(0.4);opacity:0.3} 50%{transform:scaleY(1);opacity:0.8} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
