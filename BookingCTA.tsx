import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const textLines = [
  { text: 'R\u00c9SERVEZ', size: '12vw' },
  { text: 'VOTRE PLACE', size: '10vw' },
  { text: 'R\u00c9SERVEZ', size: '8vw' },
  { text: 'VOTRE PLACE', size: '7vw' },
  { text: 'R\u00c9SERVEZ', size: '10vw' },
  { text: 'VOTRE PLACE', size: '12vw' },
]

export default function BookingCTA() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRepeaterRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !textRepeaterRef.current || !formRef.current) return

    const headings = textRepeaterRef.current.querySelectorAll('.reveal-text')

    // Pin section
    const pinSt = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: '+=150%',
      pin: true,
    })

    // Fade text on scroll
    gsap.to(headings, {
      opacity: 0,
      stagger: 0.3,
      ease: 'none',
      scrollTrigger: {
        trigger: textRepeaterRef.current,
        start: 'top 50%',
        end: 'bottom 30%',
        scrub: true,
      },
    })

    // Fade in form
    gsap.fromTo(formRef.current,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.8,
        scrollTrigger: {
          trigger: formRef.current,
          start: 'top 85%',
          toggleActions: 'play reverse restart reverse',
        },
      }
    )

    return () => {
      pinSt.kill()
    }
  }, [])

  return (
    <div
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 600,
        backgroundColor: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Background image */}
      <img
        src="/juniorsacademy.jpg"
        alt="Juniors Academy"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
        }}
      />

      {/* Dark overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(3, 7, 18, 0.5)',
        zIndex: 2,
      }} />

      {/* Content with mix-blend-mode */}
      <div style={{
        position: 'relative',
        zIndex: 3,
        width: '100%',
        height: '100%',
        mixBlendMode: 'darken',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div
          ref={textRepeaterRef}
          style={{
            backgroundColor: '#ffffff',
            color: '#000000',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 0',
          }}
        >
          {textLines.map((line, index) => (
            <div
              key={index}
              className="reveal-text"
              style={{
                fontSize: line.size,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>

      {/* Booking form */}
      <div
        ref={formRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          zIndex: 4,
          padding: '60px 24px',
          background: 'linear-gradient(to top, rgba(3,7,18,0.95) 0%, transparent 100%)',
          opacity: 0,
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h3 style={{
            fontSize: 'clamp(24px, 3vw, 36px)',
            fontWeight: 700,
            letterSpacing: '-0.021em',
            color: 'var(--text-primary)',
            marginBottom: 16,
            textAlign: 'center',
          }}>
            Inscrivez votre enfant dès aujourd'hui
          </h3>
          <p style={{
            fontSize: 17,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginBottom: 32,
            maxWidth: 500,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Les places sont limitées. Rejoignez-nous pour une expérience inoubliable.
          </p>
          <div style={{ textAlign: 'center', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdNnEEnASMZep6BO_qbH1n2sN4lJO5BQ6GuMSj70NEca9CSJQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              data-cursor-hover
              style={{ padding: '16px 40px' }}
            >
              Inscrire mon enfant
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
            <a href="tel:+213550527722" className="btn-secondary" data-cursor-hover style={{ padding: '16px 40px' }}>
              Nous appeler
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
