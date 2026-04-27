import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export default function Footer() {
  const marqueeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!marqueeRef.current) return
    const tl = gsap.to(marqueeRef.current, {
      xPercent: -50,
      duration: 25,
      ease: 'none',
      repeat: -1,
    })
    return () => { tl.kill() }
  }, [])

  return (
    <footer style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Infinite marquee */}
      <div style={{
        overflow: 'hidden',
        padding: '60px 0 40px',
      }}>
        <div
          ref={marqueeRef}
          style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            width: 'max-content',
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: 'clamp(48px, 10vw, 140px)',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: 'transparent',
                WebkitTextStroke: '1px rgba(255,255,255,0.1)',
                marginRight: 60,
                textTransform: 'uppercase',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              JUNIORS ACADEMY
            </span>
          ))}
        </div>
      </div>

      {/* Footer content */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
        borderTop: '1px solid var(--border)',
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Juniors Academy
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 400, lineHeight: 1.5 }}>
            Des programmes d'échange culturel aux standards internationaux d'excellence
          </p>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <a
            href="https://www.instagram.com/juniors.academy.dz"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            data-cursor-hover
          >
            Instagram
          </a>
          <a
            href="mailto:admin@juniors.academy"
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            data-cursor-hover
          >
            Email
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          &copy; 2025 Juniors Academy. Tous droits réservés.
        </p>
      </div>
    </footer>
  )
}
