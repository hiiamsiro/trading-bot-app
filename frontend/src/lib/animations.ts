/**
 * Framer Motion animation variants — production-ready, physics-based.
 * Import any variant and pass it as `variants` to motion components.
 */
import type { Variants } from 'framer-motion'

/* ─────────────────────────────────────────
   SPRING TRANSITIONS
   Natural, physics-based motion feel.
───────────────────────────────────────── */
export const spring = {
  type: 'spring' as const,
  stiffness: 120,
  damping: 18,
  mass: 0.8,
}

export const springSlow = {
  type: 'spring' as const,
  stiffness: 60,
  damping: 20,
  mass: 1,
}

export const springSnappy = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
  mass: 0.5,
}

/* ─────────────────────────────────────────
   TIMING
───────────────────────────────────────── */
export const durations = {
  fast:    0.15,
  normal:  0.25,
  medium:  0.4,
  slow:    0.6,
  slower:  0.9,
}

/* ─────────────────────────────────────────
   FADE + TRANSLATE (scroll reveal base)
───────────────────────────────────────── */
export function fadeUp(delay = 0, dur = durations.medium): Variants {
  return {
    hidden: { opacity: 0, y: 40, scale: 0.96 },
    visible: {
      opacity: 1, y: 0, scale: 1,
      transition: { duration: dur, delay, ease: [0.22, 1, 0.36, 1] },
    },
  }
}

export function fadeLeft(delay = 0, dur = durations.medium): Variants {
  return {
    hidden: { opacity: 0, x: -48 },
    visible: {
      opacity: 1, x: 0,
      transition: { duration: dur, delay, ease: [0.22, 1, 0.36, 1] },
    },
  }
}

export function fadeRight(delay = 0, dur = durations.medium): Variants {
  return {
    hidden: { opacity: 0, x: 48 },
    visible: {
      opacity: 1, x: 0,
      transition: { duration: dur, delay, ease: [0.22, 1, 0.36, 1] },
    },
  }
}

export function fadeScale(delay = 0, dur = durations.medium): Variants {
  return {
    hidden: { opacity: 0, scale: 0.85 },
    visible: {
      opacity: 1, scale: 1,
      transition: { duration: dur, delay, ease: [0.22, 1, 0.36, 1] },
    },
  }
}

/* ─────────────────────────────────────────
   STAGGER CHILDREN
   Use with AnimatePresence + StaggerChildren.
───────────────────────────────────────── */
export function staggerContainer(staggerChildren = 0.08, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  }
}

export function staggerChild(variant: Variants): Variants {
  return variant
}

/* ─────────────────────────────────────────
   PAGE TRANSITIONS
   Wrap route content with these for page entry.
───────────────────────────────────────── */
export const pageIn: Variants = {
  hidden: { opacity: 0, scale: 0.98, filter: 'blur(4px)' },
  visible: {
    opacity: 1, scale: 1, filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0, scale: 1.02, filter: 'blur(4px)',
    transition: { duration: 0.25, ease: 'easeIn' },
  },
}

/* ─────────────────────────────────────────
   HERO TEXT — word-by-word reveal
───────────────────────────────────────── */
export function heroText(containerDelay = 0.2): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.06, delayChildren: containerDelay },
    },
  }
}

export const heroWord: Variants = {
  hidden: { opacity: 0, y: 24, rotateX: -15 },
  visible: {
    opacity: 1, y: 0, rotateX: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

/* ─────────────────────────────────────────
   CARD HOVER — spring lift + glow
   Use whileHover / whileTap on motion.div
───────────────────────────────────────── */
export const cardHover = {
  rest: {
    y: 0, scale: 1, boxShadow: '0 0 0 0 rgba(0,0,0,0)',
    transition: spring,
  },
  hover: {
    y: -8, scale: 1.02,
    boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
    transition: spring,
  },
}

/* ─────────────────────────────────────────
   BUTTON — press + magnetic
───────────────────────────────────────── */
export const buttonTap: Variants = {
  rest:   { scale: 1 },
  hover:  { scale: 1.03, transition: springSnappy },
  tap:    { scale: 0.97, transition: springSnappy },
}

/* ─────────────────────────────────────────
   SVG PATH DRAW
   Apply strokeDashoffset animation.
   strokeDasharray="1000" strokeDashoffset="1000"
   initial={{ strokeDashoffset: 1000 }}
   animate={{ strokeDashoffset: 0 }}
───────────────────────────────────────── */
export function svgDraw(dur = 1.5, delay = 0): Variants {
  return {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1, opacity: 1,
      transition: { duration: dur, delay, ease: 'easeInOut' },
    },
  }
}

/* ─────────────────────────────────────────
   NUMBER FLIP — for price counters
───────────────────────────────────────── */
export function numberFlip(delay = 0): Variants {
  return {
    hidden: { opacity: 0, y: 20, rotateX: -90 },
    visible: {
      opacity: 1, y: 0, rotateX: 0,
      transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] },
    },
  }
}

/* ─────────────────────────────────────────
   TESTIMONIAL CAROUSEL
───────────────────────────────────────── */
export function testimonialSlide(direction: 1 | -1 = 1): Variants {
  return {
    enter:  { opacity: 0, x: direction * 80, scale: 0.95 },
    center: { opacity: 1, x: 0,       scale: 1 },
    exit:   { opacity: 0, x: direction * -80, scale: 0.95 },
  }
}

/* ─────────────────────────────────────────
   CURSOR GLOW — follows mouse
   Applied via whileMove on a motion.div
───────────────────────────────────────── */
export function cursorGlow(duration = 0.15): Variants {
  return {
    initial: { opacity: 0.6, scale: 0.8 },
    whileHover: {
      opacity: 1, scale: 1.2,
      transition: { duration, ease: 'linear' },
    },
  }
}

/* ─────────────────────────────────────────
   AMBIENT FLOAT — looping background
───────────────────────────────────────── */
export const ambientFloat: Variants = {
  animate: {
    y: [0, -16, -8, 0],
    x: [0, 6, -4, 0],
    transition: {
      duration: 9,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/* ─────────────────────────────────────────
   PULSE RING — security heartbeat
───────────────────────────────────────── */
export const pulseRing: Variants = {
  animate: {
    scale: [1, 1.3, 1],
    opacity: [0.6, 0, 0.6],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeOut' },
  },
}

/* ─────────────────────────────────────────
   LOADING SKELETON SHIMMER
───────────────────────────────────────── */
export const shimmer: Variants = {
  animate: {
    backgroundPosition: ['-200% 0', '200% 0'],
    transition: { duration: 1.8, repeat: Infinity, ease: 'linear' },
  },
}

/* ─────────────────────────────────────────
   MARQUEE — infinite horizontal scroll
───────────────────────────────────────── */
export const marquee = (duration = 30): Variants => ({
  animate: {
    x: [0, -50 + '%'],
    transition: {
      x: { repeat: Infinity, repeatType: 'loop', duration, ease: 'linear' },
    },
  },
})

/* ─────────────────────────────────────────
   MORPH — shape/blob morphing
───────────────────────────────────────── */
export const blobMorph: Variants = {
  animate: {
    borderRadius: [
      '60% 40% 30% 70% / 60% 30% 70% 40%',
      '30% 60% 70% 40% / 50% 60% 30% 60%',
      '50% 60% 30% 60% / 30% 70% 60% 40%',
      '60% 40% 30% 70% / 60% 30% 70% 40%',
    ],
    transition: {
      duration: 12,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/* ─────────────────────────────────────────
   PARTICLE — spawn + fade
   For canvas/SVG particle systems
───────────────────────────────────────── */
export function particleSpawn(index: number): Variants {
  return {
    hidden: { opacity: 0, scale: 0, x: 0, y: 0 },
    visible: {
      opacity: [0, 1, 0.8, 0],
      scale: [0, 1.2, 1],
      transition: {
        duration: 1.5,
        delay: index * 0.08,
        repeat: Infinity,
        repeatDelay: Math.random() * 3 + 1,
        ease: 'easeOut',
      },
    },
  }
}
