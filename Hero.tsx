import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import VideoBackground from '../components/VideoBackground'

export default function Hero() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const ctasRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tl = gsap.timeline({ delay: 0.6 })
    tl.fromTo(titleRef.current, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out' })
      .fromTo(subtitleRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out' }, '-=0.7')
      .fromTo(ctasRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.5')
      .fromTo(scrollRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6 }, '-=0.3')
    return () => { tl.kill() }
  }, [])

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 600,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <VideoBackground />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 24px', maxWidth: 900 }}>
        <h1
          ref={titleRef}
          style={{
            fontSize: 'clamp(42px, 10vw, 96px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.0,
            color: '#ffffff',
            marginBottom: 20,
            textWrap: 'balance',
            opacity: 0,
            textShadow: '0 4px 40px rgba(0,0,0,0.4)',
          }}
        >
          L'excellence
          <br />
          pour vos enfants.
        </h1>
        <p
          ref={subtitleRef}
          style={{
            fontSize: 'clamp(16px, 2.5vw, 21px)',
            fontWeight: 400,
            color: 'var(--text-secondary)',
            maxWidth: 640,
            margin: '0 auto 36px',
            lineHeight: 1.5,
            opacity: 0,
          }}
        >
          Programmes internationaux pour les jeunes de 6 à 18 ans.
          Football Camps avec Arsenal et séjours culturels sur mesure.
        </p>
        <div
          ref={ctasRef}
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
            opacity: 0,
          }}
        >
          <a href="#programs" className="btn-primary" data-cursor-hover>
            Découvrir les camps
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
          <a href="#destinations" className="btn-secondary" data-cursor-hover>
            Explorer les échanges
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        ref={scrollRef}
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          opacity: 0,
          animation: 'bounceArrow 2s ease-in-out infinite 1.5s',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7"/>
        </svg>
      </div>

      <style>{`
        @keyframes bounceArrow {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
      `}</style>
    </section>
  )
}
