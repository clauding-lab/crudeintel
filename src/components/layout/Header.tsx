import { motion } from 'framer-motion'
import { Droplets } from 'lucide-react'

export function Header() {
  return (
    <motion.header
      className="sticky top-0 z-50 bg-warm-bg/90 backdrop-blur-md border-b border-warm-border"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Droplets size={22} className="text-crude-amber" strokeWidth={2.5} />
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-tight leading-none text-warm-text">
              CrudeIntel
            </h1>
            <p className="text-[10px] text-warm-text-secondary tracking-widest uppercase mt-0.5">
              The energy briefing
            </p>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
