import 'server-only'
import { openf1Fetch } from '@/lib/services/openf1'
import type { Driver } from '@/lib/types'

const OPENF1_FETCH_OPTIONS = { next: { revalidate: 60 } } as const

export interface QualifyingResult {
  resultOrder: number[]
  drivers: Driver[]
}

/**
 * Fetch the full qualifying classification (driver numbers in position order)
 * from OpenF1, along with the driver roster for that session.
 * Returns null while the session_result hasn't been published yet.
 */
export async function getQualifyingResult(sessionKey: number): Promise<QualifyingResult | null> {
  try {
    const [resultRes, driversRes] = await Promise.all([
      openf1Fetch(`/session_result?session_key=${sessionKey}`, OPENF1_FETCH_OPTIONS),
      openf1Fetch(`/drivers?session_key=${sessionKey}`, OPENF1_FETCH_OPTIONS),
    ])
    if (!resultRes.ok || !driversRes.ok) return null

    const [resultData, driversData] = await Promise.all([resultRes.json(), driversRes.json()])
    type Row = { position: number | null; driver_number: number }
    if (!Array.isArray(resultData)) return null

    const resultOrder = (resultData as Row[])
      .filter((r): r is Row & { position: number } => typeof r.position === 'number')
      .sort((a, b) => a.position - b.position)
      .map((r) => r.driver_number)

    if (resultOrder.length === 0) return null
    return { resultOrder, drivers: driversData as Driver[] }
  } catch {
    return null
  }
}
