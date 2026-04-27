import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const features = [
  {
    title: 'Cultural Immersion',
    description:
      'Students live with local families, participate in traditional ceremonies, and learn indigenous crafts. Every experience is designed to foster genuine cross-cultural understanding and empathy.',
    accent: '01',
  },
  {
    title: 'Language Mastery',
    description:
      'Intensive language programs embedded within real-world contexts. From ordering at markets to navigating public transport, fluency emerges naturally through daily practice.',
    accent: '02',
  },
  {
    title: 'Adventure & Exploration',
    description:
      'Trekking through rainforests, diving coral reefs, scaling mountain peaks. Physical challenges build resilience while creating bonds that last a lifetime.',
    accent: '03',
  },
  {
    title: 'Academic Excellence',
    description:
      'Every expedition is paired with a rigorous academic curriculum. Students earn credits while conducting field research alongside world-class educators and local experts.',
    accent: '04',
  },
]

export default function Curriculum() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const cards = sectionRef.current.querySelectorAll('.curriculum-card')
    cards.forEach((card, index) => {
      gsap.fromTo(
        card,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          delay: index * 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
          },
        }
      )
    })

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill())
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="programs"
      style={{
        position: 'relative',
        backgroundColor: '#f8f9fa',
        padding: '120px 48px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 80, maxWidth: 600 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#ff7a00',
              display: 'block',
              marginBottom: 16,
            }}
          >
            Our Philosophy
          </span>
          <h2
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#111111',
              textWrap: 'balance',
            }}
          >
            Learning beyond boundaries
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
            gap: 24,
          }}
        >
          {features.map((feature) => (
            <div
              key={feature.accent}
              className="curriculum-card"
              data-cursor-hover
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: '48px 40px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.4s ease, box-shadow 0.4s ease',
                opacity: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 24px 64px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <span
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 64,
                  fontWeight: 800,
                  color: 'rgba(255, 122, 0, 0.12)',
                  lineHeight: 1,
                  position: 'absolute',
                  top: 24,
                  right: 32,
                }}
              >
                {feature.accent}
              </span>
              <h3
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: 32,
                  fontWeight: 400,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  color: '#111111',
                  marginBottom: 16,
                  textWrap: 'balance',
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  color: '#a2a2a2',
                  textWrap: 'pretty',
                }}
              >
                {feature.description}
              </p>
              <div
                style={{
                  width: 40,
                  height: 2,
                  backgroundColor: '#ff7a00',
                  marginTop: 32,
                  transition: 'width 0.3s ease',
                }}
                className="card-line"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
