import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const els = sectionRef.current.querySelectorAll('.reveal-contact')
    els.forEach((el, i) => {
      gsap.fromTo(el, { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, delay: i * 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      })
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      id="contact"
      style={{ padding: '120px 24px', background: 'var(--bg)' }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="reveal-contact" style={{ textAlign: 'center', marginBottom: 60, opacity: 0 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Contact</p>
          <h2 style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.021em',
          }}>
            Discutons de votre projet.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 40,
        }}>
          {/* Contact info */}
          <div className="reveal-contact" style={{ opacity: 0 }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.021em' }}>
              Juniors Academy
            </h3>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Notre équipe vous accompagne pour construire le meilleur séjour pour votre enfant.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <ContactItem
                icon={
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'var(--accent)' }}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                }
                text="25 Rue Rabah Bourbia, El Biar, Alger"
              />
              <ContactItem
                icon={
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'var(--accent)' }}>
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                }
                text="+213 (0) 550 52 77 22"
                href="tel:+213550527722"
              />
              <ContactItem
                icon={
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'var(--accent)' }}>
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                }
                text="admin@juniors.academy"
                href="mailto:admin@juniors.academy"
              />
            </div>

            {/* Partner */}
            <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Partenaire officiel
              </p>
              <a
                href="https://www.arsenal.com/arsenalfootballdevelopment-1"
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-hover
              >
                <img
                  src="/images/arsenal.jpg"
                  alt="Arsenal Football Development"
                  style={{ height: 40, opacity: 0.85, borderRadius: 8, transition: 'opacity 0.3s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85' }}
                />
              </a>
            </div>
          </div>

          {/* Map */}
          <div className="reveal-contact" style={{ opacity: 0 }}>
            <div style={{
              borderRadius: 20,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              height: '100%',
              minHeight: 280,
            }}>
              <iframe
                src="https://www.google.com/maps?q=Q29P%2B3W%20El%20Biar&z=16&output=embed"
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 280,
                  border: 'none',
                  filter: 'grayscale(100%) invert(92%) contrast(83%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactItem({ icon, text, href }: { icon: React.ReactNode; text: string; href?: string }) {
  const content = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        fontSize: 15,
        color: 'var(--text-secondary)',
        transition: 'color 0.3s',
        cursor: href ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => { if (href) e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { if (href) e.currentTarget.style.color = 'var(--text-secondary)' }}
      data-cursor-hover={href ? true : undefined}
    >
      {icon}
      <span>{text}</span>
    </div>
  )

  if (href) {
    return <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</a>
  }
  return content
}
