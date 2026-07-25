'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import type { Driver } from '@/lib/types'

const ANIMATION_MS = 300

interface QualifyingResultsPanelProps {
  resultOrder: number[]
  drivers: Driver[]
  sessionLabel: string
}

export default function QualifyingResultsPanel({
  resultOrder,
  drivers,
  sessionLabel,
}: QualifyingResultsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const rafRef = useRef<number>(0)

  const driverMap = useMemo(() => {
    const map = new Map<number, Driver>()
    drivers.forEach((d) => map.set(d.driver_number, d))
    return map
  }, [drivers])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => setIsVisible(true))
        rafRef.current = raf2
      })
      rafRef.current = raf1
      return () => cancelAnimationFrame(rafRef.current)
    }

    setIsVisible(false)
    const timeout = setTimeout(() => setShouldRender(false), ANIMATION_MS)
    return () => clearTimeout(timeout)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (resultOrder.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="qualifying-results-panel"
        className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-lg border border-r-0 border-white/10 bg-black/70 px-2 py-3 text-white/60 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 3v18M4 4h11l-1.5 3L15 10H4" />
        </svg>
        <span className="text-[10px] font-medium tracking-wide [writing-mode:vertical-rl]">
          Qualifying
        </span>
      </button>

      {mounted && shouldRender &&
        createPortal(
          <div
            className="fixed inset-0 z-40"
            role="dialog"
            aria-modal="true"
            id="qualifying-results-panel"
            aria-label={`${sessionLabel} results`}
          >
            <div
              className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ease-in-out ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => setIsOpen(false)}
              aria-hidden
            />

            <div
              className={`fixed inset-y-0 right-0 flex w-80 max-w-[85vw] transform flex-col border-l border-white/10 bg-carbon-black shadow-2xl transition-transform duration-300 ease-in-out ${
                isVisible ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">{sessionLabel} results</h2>
                  <p className="text-xs text-white/50">Base your prediction on the grid</p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close qualifying results"
                  className="shrink-0 rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                <ul className="flex flex-col gap-2">
                  {resultOrder.map((driverNumber, index) => {
                    const driver = driverMap.get(driverNumber)
                    return (
                      <li
                        key={driverNumber}
                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2"
                      >
                        <span className="w-6 shrink-0 text-center text-xs font-semibold text-white/50 tabular-nums">
                          {index + 1}
                        </span>
                        <div
                          className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2"
                          style={{ borderColor: driver ? `#${driver.team_colour}` : undefined }}
                        >
                          {driver?.headshot_url ? (
                            <Image
                              src={driver.headshot_url}
                              alt={driver.full_name}
                              width={32}
                              height={32}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white/10 text-[10px] font-bold text-white">
                              {driver?.name_acronym ?? '?'}
                            </div>
                          )}
                        </div>
                        <span className="flex-1 truncate text-sm font-medium text-white">
                          {driver?.full_name ?? `#${driverNumber}`}
                        </span>
                        {driver && (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: `#${driver.team_colour}` }}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
