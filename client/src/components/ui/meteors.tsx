import React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

type MeteorsProps = {
  className?: string
  number?: number
}

export const Meteors = React.memo(({ className, number = 12 }: MeteorsProps) => (
  <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
    {Array.from({ length: number }, (_, index) => {
      const top = (index * 17 + 6) % 48
      const left = (index * 29 + 3) % 106
      return (
        <motion.span
          className="meteor-effect"
          key={`meteor-${index}`}
          style={{ left: `${left}%`, top: `${top}%` }}
          initial={{ opacity: 0, rotate: -38, x: 0, y: 0 }}
          animate={{ opacity: [0, 0.9, 0], x: [0, 230], y: [0, 230] }}
          transition={{
            delay: (index % 6) * 1.35,
            duration: 2.6 + (index % 4) * 0.35,
            ease: 'linear',
            repeat: Infinity,
            repeatDelay: 5 + (index % 5) * 0.7,
          }}
        >
          <span className="meteor-effect-tail" />
        </motion.span>
      )
    })}
  </div>
))

Meteors.displayName = 'Meteors'