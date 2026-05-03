import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const paymentStatusRouter = Router()

const STATE_DIR = path.join(__dirname, '../../payment-state')
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

interface PaymentState {
  orderId: string
  sessionId: string
  timestamp: number
}

function getStatePath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(STATE_DIR, `session_${safe}.json`)
}

function readState(sessionId: string): PaymentState | null {
  try {
    const file = getStatePath(sessionId)
    if (!fs.existsSync(file)) return null
    const raw = fs.readFileSync(file, 'utf8')
    const state: PaymentState = JSON.parse(raw)
    if (Date.now() - state.timestamp > 30 * 60 * 1000) {
      fs.unlinkSync(file)
      return null
    }
    return state
  } catch {
    return null
  }
}

export function markPaymentValidated(orderId: string, sessionId?: string) {
  try {
    const id = sessionId || orderId
    const state: PaymentState = { orderId, sessionId: id, timestamp: Date.now() }
    fs.writeFileSync(getStatePath(id), JSON.stringify(state), 'utf8')
    console.log(`[PaymentStatus] Written: sessionId=${id} orderId=${orderId}`)
  } catch (e) {
    console.error('[PaymentStatus] Write error:', e)
  }
}

// GET /api/payment-status?session=xxx — read only, never modifies state
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })

  const state = readState(sessionId)
  const validated = !!state

  if (validated) {
    console.log(`[PaymentStatus] Polling validated: ${sessionId}`)
  }

  return res.json({ validated, orderId: state?.orderId || null })
})

export function isRecentPaymentValidated(sessionId: string): boolean {
  const state = readState(sessionId)
  console.log(`[PaymentStatus] Validate check: ${sessionId} → ${!!state}`)
  return !!state
}

export function consumeValidatedPayment(sessionId: string): void {
  try {
    const file = getStatePath(sessionId)
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      console.log(`[PaymentStatus] Consumed: ${sessionId}`)
    }
  } catch (e) {
    console.error('[PaymentStatus] Clear error:', e)
  }
}
