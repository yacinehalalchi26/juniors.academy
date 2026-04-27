import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const galleryImages = [
  ['/images/gallery-1.jpg', '/images/gallery-2.jpg'],
  ['/images/gallery-3.jpg', '/images/gallery-4.jpg'],
  ['/images/gallery-5.jpg', '/images/gallery-6.jpg'],
  ['/images/gallery-7.jpg', '/images/gallery-8.jpg'],
  ['/images/gallery-9.jpg', '/images/gallery-10.jpg'],
  ['/images/gallery-2.jpg', '/images/gallery-1.jpg'],
  ['/images/gallery-4.jpg', '/images/gallery-3.jpg'],
  ['/images/gallery-6.jpg', '/images/gallery-5.jpg'],
  ['/images/gallery-8.jpg', '/images/gallery-7.jpg'],
  ['/images/gallery-10.jpg', '/images/gallery-9.jpg'],
]

const destinationNames = [
  'Urban Rhythms',
  'Ancient Wisdom',
  'Alpine Solitude',
  'Tropical Dreams',
  'City of Lights',
  'Ocean Depths',
  'Mediterranean Glow',
  'Desert Mysteries',
  'European Charm',
  'Wild Horizons',
]

export default function Expeditions() {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const tilesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !tilesRef.current) return

    const tiles = tilesRef.current.querySelectorAll('.tiles__line-img')

    tiles.forEach((tile, index) => {
      const transformOrigin = index % 2 === 0 ? '0% 100%' : '100% 100%'
      gsap.set(tile, { transformOrigin })

      gsap.fromTo(
        tile,
        { scale: 0.2, rotationZ: -5, yPercent: 10 },
        {
          scale: 1.0,
          yPercent: -10,
          rotationZ: 5,
          ease: 'none',
          scrollTrigger: {
            trigger: tile,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      )
    })

    // Animate the destination names
    const nameEls = sectionRef.current.querySelectorAll('.dest-name')
    nameEls.forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            toggleActions: 'play reverse restart reverse',
          },
        }
      )
    })

    // Intro text animation
    if (titleRef.current) {
      gsap.fromTo(
        titleRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: titleRef.current,
            start: 'top 85%',
          },
        }
      )
    }

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill())
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="expeditions"
      style={{
        position: 'relative',
        backgroundColor: '#000000',
        paddingTop: 120,
        paddingBottom: 120,
        overflow: 'hidden',
      }}
    >
      {/* Introduction */}
      <div style={{ padding: '0 48px', marginBottom: 80, maxWidth: 800 }}>
        <h2
          ref={titleRef}
          style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#f8f9fa',
            marginBottom: 24,
            textWrap: 'balance',
          }}
        >
          Every journey reshapes the mind.
        </h2>
        <p
          style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1.6,
            color: '#a2a2a2',
            textWrap: 'pretty',
          }}
        >
          Our curated expeditions take young explorers to the world's most inspiring destinations.
          From ancient temples to modern metropolises, each trip is designed to broaden horizons
          and forge lifelong connections.
        </p>
      </div>

      {/* Perspective Gallery */}
      <div
        style={{
          position: 'relative',
          height: 500,
          overflow: 'hidden',
          perspective: 1000,
        }}
      >
        <div
          ref={tilesRef}
          style={{
            width: '200%',
            height: 500,
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate3d(-50%, -50%, 0)',
          }}
        >
          {galleryImages.map((row, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                display: 'flex',
                position: 'relative',
              }}
            >
              {row.map((img, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="tiles__line-img"
                  data-cursor-hover
                  style={{
                    flex: 'none',
                    width: 'calc(16.666% - 20px)',
                    height: 'calc(500px / 5 - 20px)',
                    margin: 10,
                    backgroundImage: `url(${img})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 8,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="dest-name"
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      left: 16,
                      fontFamily: "'Newsreader', serif",
                      fontStyle: 'italic',
                      fontSize: 'clamp(14px, 1.2vw, 20px)',
                      color: '#ff7a00',
                      textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                      zIndex: 2,
                    }}
                  >
                    {destinationNames[rowIndex * 2 + colIndex]}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
