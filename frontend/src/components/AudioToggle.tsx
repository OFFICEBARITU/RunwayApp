'use client'

interface Props {
  t: Record<string, string | string[]>
  enabled: boolean
  onToggle: () => void
}

export default function AudioToggle({ t, enabled, onToggle }: Props) {
  return (
    <button
      className="audio-btn"
      onClick={onToggle}
      title={enabled ? String(t.audioOff) : String(t.audioOn)}
      aria-label={enabled ? String(t.audioOff) : String(t.audioOn)}
    >
      {enabled ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4.5H4L7 2v10L4 9.5H2V4.5Z" fill="currentColor" />
          <path d="M9 4.5c1.1.5 1.8 1.5 1.8 2.5S10.1 9 9 9.5" stroke="currentColor" strokeWidth="1" fill="none"/>
          <path d="M10.5 2.5c1.8 1 3 2.7 3 4.5s-1.2 3.5-3 4.5" stroke="currentColor" strokeWidth="1" fill="none"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4.5H4L7 2v10L4 9.5H2V4.5Z" fill="currentColor" opacity="0.4"/>
          <path d="M10 4.5L13 9.5M13 4.5L10 9.5" stroke="currentColor" strokeWidth="1"/>
        </svg>
      )}
    </button>
  )
}
