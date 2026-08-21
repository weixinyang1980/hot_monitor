import React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

type SpotlightProps = {
  className?: string
  gradientFirst?: string
  gradientSecond?: string
  gradientThird?: string
  translateY?: number
  width?: number
  height?: number
  smallWidth?: number
  duration?: number
  xOffset?: number
}

export const Spotlight = React.memo(({
  className,
  gradientFirst = 'radial-gradient(68.54% 68.72% at 55.02% 31.46%, rgba(99, 226, 207, 0.2) 0, rgba(99, 226, 207, 0.04) 48%, transparent 78%)',
  gradientSecond = 'radial-gradient(50% 50% at 50% 50%, rgba(91, 169, 255, 0.12) 0, rgba(91, 169, 255, 0.025) 76%, transparent 100%)',
  gradientThird = 'radial-gradient(50% 50% at 50% 50%, rgba(242, 182, 109, 0.1) 0, rgba(242, 182, 109, 0.015) 76%, transparent 100%)',
  translateY = -350,
  width = 560,
  height = 1380,
  smallWidth = 240,
  duration = 8,
  xOffset = 100,
}: SpotlightProps) => (
  <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
    <motion.div
      className="spotlight-effect spotlight-effect-main"
      style={{ backgroundImage: gradientFirst, height, marginLeft: -width / 2, width }}
      initial={{ opacity: 0, x: -xOffset, y: translateY }}
      animate={{ opacity: [0, 1, 0.78], x: [-xOffset, 0, xOffset], y: [translateY, translateY + 58, translateY + 34] }}
      transition={{ duration, ease: 'easeInOut', times: [0, 0.55, 1] }}
    />
    <motion.div
      className="spotlight-effect spotlight-effect-secondary"
      style={{ backgroundImage: gradientSecond, height: height * 0.64, marginLeft: -(width * 0.7) / 2, width: width * 0.7 }}
      initial={{ opacity: 0, x: xOffset, y: translateY + 90 }}
      animate={{ opacity: [0, 0.78, 0.58], x: [xOffset, 0, -xOffset * 0.45], y: [translateY + 90, translateY + 136, translateY + 118] }}
      transition={{ delay: 0.35, duration: duration + 1.2, ease: 'easeInOut', times: [0, 0.6, 1] }}
    />
    <motion.div
      className="spotlight-effect spotlight-effect-accent"
      style={{ backgroundImage: gradientThird, height: height * 0.34, marginLeft: -smallWidth / 2, width: smallWidth }}
      initial={{ opacity: 0, x: -xOffset * 0.2, y: translateY + 166 }}
      animate={{ opacity: [0, 0.65, 0.4], x: [-xOffset * 0.2, xOffset * 0.25, 0], y: [translateY + 166, translateY + 194, translateY + 180] }}
      transition={{ delay: 0.7, duration: duration - 0.5, ease: 'easeInOut', times: [0, 0.55, 1] }}
    />
  </div>
))

Spotlight.displayName = 'Spotlight'