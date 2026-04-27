import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: -100, y: -100 })
  const current = useRef({ x: -100, y: -100 })

  useEffect(() => {
    // Skip on touch devices
    if ('ontouchstart' in window) return

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX
      target.current.y = e.clientY
    }

    const onHover = () => {
      ringRef.current?.style.setProperty('transform', `translate(${current.current.x - 20}px, ${current.current.y - 20}px) scale(2.5)`)
    }
    const onLeave = () => {
      ringRef.current?.style.setProperty('transform', `translate(${current.current.x - 20}px, ${current.current.y - 20}px) scale(1)`)
    }

    window.addEventListener('mousemove', onMove)

    const interactiveEls = document.querySelectorAll('a, button, [data-cursor-hover], input, select, textarea')
    interactiveEls.forEach((el) => {
      el.addEventListener('mouseenter', onHover)
      el.addEventListener('mouseleave', onLeave)
    })

    let raf: number
    const animate = () => {
      current.current.x += (target.current.x - current.current.x) * 0.15
      current.current.y += (target.current.y - current.current.y) * 0.15

      dotRef.current?.style.setProperty('transform', `translate(${target.current.x - 4}px, ${target.current.y - 4}px)`)
      if (ringRef.current) {
        const transform = ringRef.current.style.transform
        if (!transform.includes('scale')) {
          ringRef.current.style.setProperty('transform', `translate(${current.current.x - 20}px, ${current.current.y - 20}px)`)
        }
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMove)
      interactiveEls.forEach((el) => {
        el.removeEventListener('mouseenter', onHover)
        el.removeEventListener('mouseleave', onLeave)
      })
      cancelAnimationFrame(raf)
    }
  }, [])

  // Don't render on touch devices
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null

  return (
    <>
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          pointerEvents: 'none',
          zIndex: 99999,
          mixBlendMode: 'difference',
          transition: 'width 0.2s, height 0.2s',
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1px solid rgba(220, 20, 60, 0.4)',
          pointerEvents: 'none',
          zIndex: 99998,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </>
  )
}
