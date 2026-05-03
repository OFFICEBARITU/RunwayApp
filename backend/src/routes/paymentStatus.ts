import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const paymentStatusRouter = Router()

const STATE_FILE = path.join(__dirname, '../../payment-state.json')

interface PaymentState {
  orderId: string
  sessionId?: string
  timestamp: number
  consumed: boolean
}

function readState(): PaymentState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const state: PaymentState = JSON.parse(raw)
    // Expire after 30 minutes
    if (Date.now() - state.timestamp > 30 * 60 * 1000) {
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
    const state: PaymentState = {
      orderId,
      sessionId,
      timestamp: Date.now(),
      consumed: false
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8')
    console.log(`[PaymentStatus] Written to disk: ${orderId}`)
  } catch (e) {
    console.error('[PaymentStatus] Write error:', e)
  }
}

function clearState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE)
  } catch {}
}

export function markPaymentValidated(orderId: string, sessionId?: string) {
  writeState(orderId, sessionId)
}

// GET /api/payment-status?session=xxx
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })

  const state = readState()
  if (!state || state.consumed) {
    return res.json({ validated: false, orderId: null })
  }

  // Match by direct sessionId OR by time window (10 min)
  const sessionTimestamp = parseInt(
    sessionId.replace('ls_', '').replace('gm_', '')
  )
  const timeMatch =
    !isNaN(sessionTimestamp) &&
    Date.now() - sessionTimestamp < 10 * 60 * 1000 // 10 min window
  const directMatch = state.sessionId === sessionId

  const validated = directMatch || timeMatch

  if (validated) {
    // Lock immediately — stops polling loop at the source
    state.consumed = true
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8')
    console.log(`[PaymentStatus] Validated+locked: ${sessionId} orderId:${state.orderId}`)
  }

  return res.json({ validated, orderId: validated ? state.orderId : null })
})

export function isRecentPaymentValidated(sessionId: string): boolean {
  const state = readState()
  if (!state || state.consumed) return false

  const sessionTimestamp = parseInt(
    sessionId.replace('ls_', '').replace('gm_', '')
  )
  // 10 minute window — enough for slow payers
  if (!isNaN(sessionTimestamp)) {
    return Date.now() - sessionTimestamp < 10 * 60 * 1000
  }
  return state.sessionId === sessionId
}

export function consumeValidatedPayment(): void {
  clearState()
  console.log(`[PaymentStatus] Cleared after analysis`)
}
