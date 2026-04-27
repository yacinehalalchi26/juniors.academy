import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface ProgramCardProps {
  image: string
  tag: string
  title: string
  description: string
  delay: number
}

function ProgramCard({ image, tag, title, description, delay }: ProgramCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const card = cardRef.current
    const img = imgRef.current
    if (!card || !img) return

    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      img.style.transform = `translate(${-x * 20}px, ${-y * 20}px) scale(1.1)`
      card.style.transform = `perspective(1000px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`
    }

    const onLeave = () => {
      img.style.transform = 'translate(0, 0) scale(1)'
      card.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)'
    }

    card.addEventListener('mousemove', onMove)
    card.addEventListener('mouseleave', onLeave)

    // Scroll animation
    gsap.fromTo(card,
      { y: 60, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.9, delay,
        ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 85%' },
      }
    )

    return () => {
      card.removeEventListener('mousemove', onMove)
      card.removeEventListener('mouseleave', onLeave)
    }
  }, [delay])

  return (
    <div
      ref={cardRef}
      style={{
        position: 'relative',
        borderRadius: 24,
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        transition: 'transform 0.15s ease-out, border-color 0.4s',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        opacity: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
      data-cursor-hover
    >
      <div style={{ position: 'relative', height: 300, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent 0%, var(--bg-secondary) 100%)',
          zIndex: 2,
          pointerEvents: 'none',
        }} />
        <img
          ref={imgRef}
          src={image}
          alt={title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.15s ease-out',
            willChange: 'transform',
          }}
        />
      </div>
      <div style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span className="eyebrow" style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 4, background: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
          {tag}
        </span>
        <h3 style={{
          fontSize: 'clamp(22px, 3vw, 28px)',
          fontWeight: 700,
          letterSpacing: '-0.021em',
          marginBottom: 12,
          color: 'var(--text-primary)',
        }}>
          {title}
        </h3>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
          {description}
        </p>
      </div>
    </div>
  )
}

export default function Programs() {
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headerRef.current) return
    gsap.fromTo(headerRef.current,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: headerRef.current, start: 'top 85%' } }
    )
  }, [])

  return (
    <section id="programs" style={{ padding: '120px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div ref={headerRef} style={{ textAlign: 'center', marginBottom: 60, opacity: 0 }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Nos Programmes</p>
        <h2 style={{
          fontSize: 'clamp(32px, 6vw, 56px)',
          fontWeight: 700,
          letterSpacing: '-0.021em',
          marginBottom: 16,
          color: 'var(--text-primary)',
        }}>
          Deux univers. Une excellence.
        </h2>
        <p style={{ fontSize: 19, color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto', lineHeight: 1.4 }}>
          Choisissez l'expérience qui correspond aux aspirations de votre enfant.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
        gap: 24,
      }}>
        <ProgramCard
          image="/images/beijing-card.jpg"
          tag="Culturel"
          title="Cultural Exchange"
          description="Séjours linguistiques et programmes d'échanges culturels sur mesure. Pékin, Angleterre, Suisse, Espagne — pour ouvrir le monde aux juniors."
          delay={0}
        />
        <ProgramCard
          image="/images/arsenal.jpg"
          tag="Sports"
          title="Football Camps"
          description="Stage de football de haut niveau en Angleterre avec des clubs de Premier League. Entraînements pro, immersion linguistique et encadrement 24/7."
          delay={0.15}
        />
      </div>
    </section>
  )
}
