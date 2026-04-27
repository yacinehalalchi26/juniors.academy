import { useEffect, useRef, useState } from 'react'

export default function VideoBackground() {
  const [loaded, setLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    // Fallback: show gradient after 3s if iframe hasn't loaded
    const timer = setTimeout(() => setLoaded(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
      {/* Dark gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(3,7,18,0.3) 0%, rgba(3,7,18,0.5) 50%, rgba(3,7,18,0.85) 100%)',
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* YouTube embed */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100vw',
        height: '56.25vw', /* 16:9 */
        minHeight: '100vh',
        minWidth: '177.78vh', /* 16:9 inverse */
        opacity: loaded ? 1 : 0,
        transition: 'opacity 1s ease',
      }}>
        <iframe
          ref={iframeRef}
          src="https://www.youtube.com/embed/DLEybFen6QA?autoplay=1&mute=1&loop=1&playlist=DLEybFen6QA&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&start=0"
          allow="autoplay; encrypted-media; fullscreen"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            pointerEvents: 'none',
          }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}
