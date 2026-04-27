import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Navigation from './sections/Navigation'
import Hero from './sections/Hero'
import Programs from './sections/Programs'
import FootballFeatures from './sections/FootballFeatures'
import Destinations from './sections/Destinations'
import BookingCTA from './sections/BookingCTA'
import Contact from './sections/Contact'
import Footer from './sections/Footer'
import CustomCursor from './components/CustomCursor'
import FloatingCall from './components/FloatingCall'

gsap.registerPlugin(ScrollTrigger)

function App() {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
    }
  }, [])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <CustomCursor />
      <FloatingCall />
      <Navigation />
      <Hero />
      <Programs />
      <FootballFeatures />
      <Destinations />
      <BookingCTA />
      <Contact />
      <Footer />
    </div>
  )
}

export default App
