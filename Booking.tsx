import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const textSizes = ['12vw', '10vw', '8vw', '7vw', '10vw', '12vw']

export default function Booking() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRepeaterRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !textRepeaterRef.current || !formRef.current) return

    const headings = textRepeaterRef.current.querySelectorAll('.heading-booking')

    // Pin the section
    const pinTl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=200%',
        pin: true,
        scrub: true,
      },
    })

    // Fade text headings as user scrolls
    gsap.to(headings, {
      opacity: 0,
      stagger: 0.5,
      ease: 'none',
      scrollTrigger: {
        trigger: textRepeaterRef.current,
        start: 'top 50%',
        end: 'bottom 50%',
        scrub: true,
      },
    })

    // Fade in booking form
    gsap.fromTo(
      formRef.current,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        scrollTrigger: {
          trigger: formRef.current,
          start: 'top 80%',
          toggleActions: 'play reverse restart reverse',
        },
      }
    )

    return () => {
      pinTl.kill()
      ScrollTrigger.getAll().forEach((st) => st.kill())
    }
  }, [])

  return (
    <div
      ref={sectionRef}
      id="contact"
      className="overlay-booking"
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Background image */}
      <img
        src="/images/booking-bg.jpg"
        alt="Students exploring"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
        }}
      />

      {/* Dark overlay that fades */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 2,
        }}
      />

      {/* Content with blend mode */}
      <div
        className="content-booking"
        style={{
          position: 'relative',
          zIndex: 3,
          width: '100%',
          height: '100%',
          mixBlendMode: 'darken',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Text Repeater - creates the X-ray mask */}
        <div
          ref={textRepeaterRef}
          className="text-repeater"
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
          {textSizes.map((size, index) => (
            <div
              key={index}
              className="heading-booking"
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: size,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {index % 2 === 0 ? 'BOOK YOUR' : 'EXPEDITION'}
            </div>
          ))}
        </div>
      </div>

      {/* Booking Form - appears after scroll */}
      <div
        ref={formRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          zIndex: 4,
          padding: '60px 48px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
          opacity: 0,
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h3
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 'clamp(24px, 3vw, 40px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: '#f8f9fa',
              marginBottom: 32,
            }}
          >
            Start Your Journey
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <input
              type="text"
              placeholder="Full Name"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                padding: '14px 20px',
                color: '#f8f9fa',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.3s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#ff7a00')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
            />
            <input
              type="email"
              placeholder="Email Address"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                padding: '14px 20px',
                color: '#f8f9fa',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.3s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#ff7a00')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
            />
            <select
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                padding: '14px 20px',
                color: '#a2a2a2',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.3s',
                cursor: 'pointer',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#ff7a00')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
              defaultValue=""
            >
              <option value="" disabled>
                Select Destination
              </option>
              <option value="kyoto">Kyoto, Japan</option>
              <option value="london">London, UK</option>
              <option value="swiss">Swiss Alps</option>
              <option value="bali">Bali, Indonesia</option>
              <option value="safari">African Safari</option>
            </select>
          </div>
          <button
            data-cursor-hover
            style={{
              marginTop: 24,
              backgroundColor: '#ff7a00',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '16px 48px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background-color 0.3s, transform 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e66d00'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff7a00'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Request Information
          </button>
        </div>
      </div>
    </div>
  )
}
