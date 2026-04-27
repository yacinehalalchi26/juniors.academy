import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface Destination {
  location: string
  title: string
  desc: string
  features: string[]
  image: string
}

const destinations: Destination[] = [
  {
    location: 'Asie \u2022 P\u00e9kin',
    title: 'Une immersion culturelle unique.',
    desc: 'Programme sur mesure de 6 \u00e0 18 ans. Grande Muraille, Cit\u00e9 interdite, ateliers de mandarin et d\u00e9couverte des Hutongs avec encadrement 24/7.',
    features: ['Itin\u00e9raire personnalis\u00e9 avec l\'\u00e9tablissement', 'Ateliers de langue et culture adapt\u00e9s', 'H\u00e9bergements s\u00e9lectionn\u00e9s pour les jeunes'],
    image: '/images/beijing-dest.jpg',
  },
  {
    location: 'Europe \u2022 Angleterre',
    title: 'La vie de campus britannique.',
    desc: 'Cours d\'anglais communicatifs en petits groupes, excursions \u00e0 Londres et Oxford, dans des \u00e9coles partenaires prestigieuses.',
    features: ['Uppingham, Oundle, Worth & Brambletye School', 'Excursions vers sites embl\u00e9matiques', 'Communication r\u00e9guli\u00e8re avec les parents'],
    image: '/images/england-dest.jpg',
  },
  {
    location: 'Europe \u2022 Suisse',
    title: 'Camps alpins internationaux.',
    desc: 'Exp\u00e9rience en montagne entre sport, nature et langues. Ski, snowboard, randonn\u00e9es et multi-activit\u00e9s dans un cadre exceptionnel.',
    features: ['Programmes adapt\u00e9s \u00e0 chaque saison', 'Rencontres avec participants du monde entier', 'Encadrement sp\u00e9cialis\u00e9 jeunes'],
    image: '/images/Swiss.jpg',
  },
  {
    location: 'Europe \u2022 Espagne',
    title: 'Soleil, plage et d\u00e9couvertes.',
    desc: "Un s\u00e9jour ensoleill\u00e9 o\u00f9 les juniors peuvent choisir d'apprendre l'espagnol ou perfectionner leur anglais, tout en profitant de magnifiques plages, de visites culturelles et de beaucoup de fun.",
    features: ["Choix entre cours d'espagnol ou d'anglais", 'Plages, sports nautiques et activit\u00e9s en plein air', 'Visites culturelles et d\u00e9couvertes locales', 'H\u00e9bergement s\u00e9curis\u00e9 avec encadrement 24/7'],
    image: '/images/spain.jpg',
  },
]

function DestinationCard({ dest, index }: { dest: Destination; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const isReverse = index % 2 !== 0

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    gsap.fromTo(card, { y: 60, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 80%' },
    })
  }, [])

  return (
    <div
      ref={cardRef}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
        gap: 48,
        alignItems: 'center',
        marginBottom: index < destinations.length - 1 ? 100 : 0,
        direction: isReverse ? 'rtl' : 'ltr',
        opacity: 0,
      }}
    >
      {/* Image */}
      <div
        data-cursor-hover
        style={{
          position: 'relative',
          borderRadius: 24,
          overflow: 'hidden',
          aspectRatio: '4/3',
          direction: 'ltr',
        }}
      >
        <img
          src={dest.image}
          alt={dest.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        />
      </div>

      {/* Content */}
      <div style={{ padding: '20px 0', direction: 'ltr' }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>{dest.location}</p>
        <h3 style={{
          fontSize: 'clamp(26px, 4vw, 40px)',
          fontWeight: 700,
          letterSpacing: '-0.021em',
          marginBottom: 16,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
        }}>
          {dest.title}
        </h3>
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
          {dest.desc}
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {dest.features.map((f, i) => (
            <li
              key={i}
              style={{
                fontSize: 15,
                color: 'var(--text-secondary)',
                padding: '8px 0',
                paddingLeft: 24,
                position: 'relative',
              }}
            >
              <span style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 6,
                height: 6,
                background: 'var(--accent)',
                borderRadius: '50%',
              }} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function Destinations() {
  const sectionRef = useRef<HTMLElement>(null)
  const [culturalExpanded, setCulturalExpanded] = useState(false)

  useEffect(() => {
    if (!sectionRef.current) return
    const header = sectionRef.current.querySelector('.dest-header')
    if (header) {
      gsap.fromTo(header, { y: 50, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: header, start: 'top 85%' },
      })
    }

    const more = sectionRef.current.querySelector('.reveal-more')
    if (more) {
      gsap.fromTo(more, { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: more, start: 'top 88%' },
      })
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="destinations"
      style={{ padding: '120px 24px', background: 'var(--bg-secondary)' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="dest-header" style={{ textAlign: 'center', marginBottom: 60, opacity: 0 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Programme Cultural Exchange</p>
          <h2 style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.021em',
            marginBottom: 16,
          }}>
            Le monde à portée de main.
          </h2>
        </div>

        {/* Cultural intro with expand */}
        <div style={{ maxWidth: 800, margin: '0 auto 80px', textAlign: 'center' }}>
          <p style={{ fontSize: 19, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
            L'échange culturel est l'un des cadeaux les plus précieux pour nos juniors. Découvrir le monde au-delà des manuels scolaires, développer la confiance et apprendre à apprécier la diversité.
          </p>
          <div style={{
            maxHeight: culturalExpanded ? 400 : 0,
            overflow: 'hidden',
            opacity: culturalExpanded ? 1 : 0,
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 20 }}>
              Cultural exchange is one of the most valuable gifts we can offer our juniors. It allows them to understand the world beyond textbooks, develop confidence, and learn to appreciate diversity with maturity and respect. At Juniors Academy, every program is designed to provide safe, meaningful exposure to new cultures—helping young people grow into open-minded, responsible, and globally aware individuals. By giving them the chance to explore, we help them build skills and perspectives that will guide them for life.
            </p>
          </div>
          <button className="glass-btn" onClick={() => setCulturalExpanded(!culturalExpanded)} data-cursor-hover style={{ marginTop: 8 }}>
            <span>{culturalExpanded ? 'Réduire' : 'Cliquez ici pour en savoir plus'}</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: culturalExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>

        {/* Destination cards */}
        {destinations.map((dest, i) => (
          <DestinationCard key={i} dest={dest} index={i} />
        ))}

        {/* More countries */}
        <div className="reveal-more" style={{
          textAlign: 'center',
          padding: '60px 0 20px',
        }}>
          <p style={{
            fontSize: 'clamp(20px, 3vw, 28px)',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            letterSpacing: '-0.01em',
          }}>
            Et bien d'autres pays à découvrir…
          </p>
          <div style={{
            width: 60,
            height: 2,
            background: 'var(--accent)',
            margin: '16px auto 0',
            borderRadius: 1,
          }} />
        </div>
      </div>
    </section>
  )
}
