import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const paymentStatusRouter = Router()

// Persist payment state to disk so it survives Render spin-down/spin-up
const STATE_FILE = path.join(__dirname, '../../payment-state.json')

interface PaymentState {
  orderId: string
  sessionId?: string
  timestamp: number
}

function readState(): PaymentState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const state: PaymentState = JSON.parse(raw)
    // Expire after 10 minutes
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      fs.unlinkSync(STATE_FILE)
      return null
    }
    return state
  } catch {
    return null
  }
}

function writeState(orderId: string, sessionId?: string): void {
  try {
    const state: PaymentState = { orderId, sessionId, timestamp: Date.now() }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8')
  } catch (e) {
    console.error('[PaymentState] Write error:', e)
  }
}

function clearState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE)
  } catch {}
}

export function markPaymentValidated(orderId: string, sessionId?: string) {
  writeState(orderId, sessionId)
  console.log(`[PaymentStatus] Saved to disk: ${orderId} | session: ${sessionId || 'none'}`)
}

// GET /api/payment-status?session=xxx
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })

  const state = readState()
  if (!state) return res.json({ validated: false, orderId: null })

  // Match by sessionId directly OR by time-window (2 min from session creation)
  const sessionTimestamp = parseInt(sessionId.replace('ls_', '').replace('gm_', ''))
  const timeMatch = !isNaN(sessionTimestamp) && (Date.now() - sessionTimestamp < 120000)
  const directMatch = state.sessionId === sessionId

  const validated = directMatch || timeMatch

  return res.json({ validated, orderId: validated ? state.orderId : null })
})

export function isRecentPaymentValidated(sessionId: string): boolean {
  const state = readState()
  if (!state) return false
  const sessionTimestamp = parseInt(sessionId.replace('ls_', '').replace('gm_', ''))
  if (isNaN(sessionTimestamp)) return false
  return Date.now() - sessionTimestamp < 120000
}

export function consumeValidatedPayment(): void {
  clearState()
}
