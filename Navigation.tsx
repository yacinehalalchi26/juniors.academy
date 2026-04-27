import { useEffect, useRef, useState } from 'react'

const navItems = [
  { label: 'Programmes', href: '#programs' },
  { label: 'Destinations', href: '#destinations' },
  { label: 'Contact', href: '#contact' },
]

export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    setMenuOpen(false)
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 52,
        background: scrolled ? 'rgba(3, 7, 18, 0.85)' : 'rgba(3, 7, 18, 0.6)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        transition: 'background 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        {/* Logo */}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary)',
            textDecoration: 'none',
            letterSpacing: '-0.03em',
            zIndex: 10002,
            position: 'relative',
          }}
          data-cursor-hover
        >
          JA
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                letterSpacing: '-0.01em',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              data-cursor-hover
            >
              {item.label}
            </a>
          ))}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSdNnEEnASMZep6BO_qbH1n2sN4lJO5BQ6GuMSj70NEca9CSJQ/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ padding: '7px 16px', fontSize: 13 }}
            data-cursor-hover
          >
            S'inscrire
          </a>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            zIndex: 10002,
            position: 'relative',
            width: 36,
            height: 36,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: 0,
          }}
          aria-label="Menu"
        >
          <span style={{
            display: 'block',
            width: 18,
            height: 1.5,
            background: 'var(--text-primary)',
            borderRadius: 1,
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: menuOpen ? 'rotate(45deg) translate(3.5px, 3.5px)' : 'none',
          }} />
          <span style={{
            display: 'block',
            width: 18,
            height: 1.5,
            background: 'var(--text-primary)',
            borderRadius: 1,
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: menuOpen ? 0 : 1,
          }} />
          <span style={{
            display: 'block',
            width: 18,
            height: 1.5,
            background: 'var(--text-primary)',
            borderRadius: 1,
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: menuOpen ? 'rotate(-45deg) translate(3.5px, -3.5px)' : 'none',
          }} />
        </button>
      </div>

      {/* Mobile fullscreen menu */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.98)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '0 40px',
          gap: 8,
          transform: menuOpen ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 9998,
        }}
        className="flex md:hidden"
      >
        {navItems.map((item, i) => (
          <a
            key={item.label}
            href={item.href}
            onClick={(e) => handleNavClick(e, item.href)}
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              padding: '10px 0',
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? 'translateY(0)' : 'translateY(15px)',
              transition: `all 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${0.08 + i * 0.04}s`,
              letterSpacing: '-0.02em',
            }}
          >
            {item.label}
          </a>
        ))}
        <div style={{
          marginTop: 32,
          paddingTop: 32,
          borderTop: '1px solid var(--border)',
          width: '100%',
          opacity: menuOpen ? 1 : 0,
          transform: menuOpen ? 'translateY(0)' : 'translateY(15px)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
        }}>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSdNnEEnASMZep6BO_qbH1n2sN4lJO5BQ6GuMSj70NEca9CSJQ/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            onClick={() => setMenuOpen(false)}
            style={{ fontSize: 15, padding: '12px 24px' }}
          >
            S'inscrire
          </a>
        </div>
      </div>
    </nav>
  )
}
