import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const paymentStatusRouter = Router()

const STATE_DIR = path.join(__dirname, '../../payment-state')
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

type PaymentStateStatus = 'validated' | 'processing' | 'consumed'

interface PaymentState {
  orderId: string
  sessionId: string
  timestamp: number
  status: PaymentStateStatus
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

function writeState(sessionId: string, state: PaymentState): void {
  fs.writeFileSync(getStatePath(sessionId), JSON.stringify(state), 'utf8')
}

export function markPaymentValidated(orderId: string, sessionId?: string) {
  try {
    const id = sessionId || orderId
    const state: PaymentState = {
      orderId,
      sessionId: id,
      timestamp: Date.now(),
      status: 'validated',
    }
    writeState(id, state)
    console.log(`[PaymentStatus] validated: sessionId=${id} orderId=${orderId}`)
  } catch (e) {
    console.error('[PaymentStatus] Write error:', e)
  }
}

export function markPaymentProcessing(sessionId: string): boolean {
  try {
    const state = readState(sessionId)
    if (!state || state.status !== 'validated') return false
    state.status = 'processing'
    writeState(sessionId, state)
    console.log(`[PaymentStatus] processing: ${sessionId}`)
    return true
  } catch (e) {
    console.error('[PaymentStatus] Processing mark error:', e)
    return false
  }
}

// GET /api/payment-status?session=xxx — read only
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })

  const state = readState(sessionId)

  const validated = state?.status === 'validated'
  const processing = state?.status === 'processing'

  if (validated) console.log(`[PaymentStatus] Polling: validated ${sessionId}`)
  if (processing) console.log(`[PaymentStatus] Polling: processing ${sessionId}`)

  return res.json({ validated, processing, orderId: state?.orderId || null })
})

export function isRecentPaymentValidated(sessionId: string): boolean {
  const state = readState(sessionId)
  const ok = state?.status === 'validated'
  console.log(`[PaymentStatus] Check: ${sessionId} → status=${state?.status} ok=${ok}`)
  return ok
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
