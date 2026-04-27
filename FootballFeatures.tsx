import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const features = [
  { icon: '\u{1F393}', title: 'Formation linguistique', desc: "Cours d'anglais immersifs adaptés au niveau de chaque enfant." },
  { icon: '\u{26BD}', title: 'Coaching pro', desc: 'Encadrement Arsenal Football Development pour les camps foot.' },
  { icon: '\u{1F6E1}', title: 'Sécurité 24/7', desc: 'Accompagnement constant et assurance complète incluse.' },
  { icon: '\u{1F3E1}', title: 'Hébergement premium', desc: 'Chambres confortables en campus avec repas équilibrés.' },
  { icon: '\u{1F30D}', title: 'Excursions', desc: "Découverte de Londres, Emirates Stadium, et sites emblématiques." },
  { icon: '\u{1F4DC}', title: 'Certification', desc: 'Certificat officiel Arsenal Football Development à la clé.' },
]

export default function FootballFeatures() {
  const sectionRef = useRef<HTMLElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!sectionRef.current) return

    const header = sectionRef.current.querySelector('.features-header')
    const cards = sectionRef.current.querySelectorAll('.feature-card')

    if (header) {
      gsap.fromTo(header, { y: 50, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: header, start: 'top 85%' },
      })
    }

    cards.forEach((card, i) => {
      gsap.fromTo(card, { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.7, delay: i * 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 88%' },
      })
    })
  }, [])

  const toggleExpand = () => setExpanded(!expanded)

  return (
    <section
      ref={sectionRef}
      id="football-program"
      style={{ padding: '120px 24px', background: 'var(--bg)' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="features-header" style={{ textAlign: 'center', marginBottom: 60, opacity: 0 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Programme Football</p>
          <h2 style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.021em',
            marginBottom: 16,
          }}>
            Une expérience complète.
          </h2>
        </div>

        {/* Expandable intro */}
        <div style={{ maxWidth: 800, margin: '0 auto 60px', textAlign: 'center' }}>
          <p style={{ fontSize: 19, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
            Des séjours linguistiques et stages de football avec{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>top English Premier League football clubs</strong>{' '}
            pour les 9–16 ans. Formation en anglais, coaching pro, hébergement premium et excursions.
          </p>
          <div style={{
            maxHeight: expanded ? 400 : 0,
            overflow: 'hidden',
            opacity: expanded ? 1 : 0,
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 20 }}>
              Notre programme combine formation en anglais, coaching sportif de haut niveau, hébergement premium et excursions passionnantes.
              Les juniors évoluent sur des terrains d'entraînement professionnels, participent à des matchs compétitifs et reçoivent un{' '}
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>certificat officiel des clubs partenaires</strong>{' '}
              à la fin de leur séjour. Avec plus de 37 ans d'expertise cumulée via nos partenaires, nous offrons une expérience complète :
              assurance médicale, transferts aéroport, encadrement 24/7 et équipements officiels.
            </p>
          </div>
          <button className="glass-btn" onClick={toggleExpand} data-cursor-hover style={{ marginTop: 8 }}>
            <span>{expanded ? 'Réduire' : "Cliquez ici pour en savoir plus"}</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>

        {/* Features grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 32,
        }}>
          {features.map((f, i) => (
            <div
              key={i}
              className="feature-card"
              data-cursor-hover
              style={{
                textAlign: 'center',
                padding: '32px 24px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(220, 20, 60, 0.3)'
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{
                width: 56,
                height: 56,
                margin: '0 auto 20px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                transition: 'all 0.3s',
              }}>
                {f.icon}
              </div>
              <h4 style={{ fontSize: 19, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.021em', color: 'var(--text-primary)' }}>
                {f.title}
              </h4>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
