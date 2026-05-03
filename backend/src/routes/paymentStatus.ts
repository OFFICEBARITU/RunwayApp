import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const paymentStatusRouter = Router()

const STATE_DIR = path.join(__dirname, '../../payment-state')
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

type PaymentStateStatus = 'validated' | 'processing'

interface PaymentState {
  orderId: string
  timestamp: number
  status: PaymentStateStatus
  product: string
}

function getStatePath(orderId: string): string {
  const safe = orderId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(STATE_DIR, `order_${safe}.json`)
}

function readState(orderId: string): PaymentState | null {
  try {
    const file = getStatePath(orderId)
    if (!fs.existsSync(file)) return null
    const raw = fs.readFileSync(file, 'utf8')
    const state: PaymentState = JSON.parse(raw)
    if (Date.now() - state.timestamp > 30 * 60 * 1000) {
      fs.unlinkSync(file)
      return null
    }
    return state
  } catch { return null }
}

function writeState(orderId: string, state: PaymentState): void {
  fs.writeFileSync(getStatePath(orderId), JSON.stringify(state), 'utf8')
}

// Called by webhook — always keyed by orderId
export function markPaymentValidated(orderId: string, _sessionId?: string, product?: string) {
  const state: PaymentState = {
    orderId,
    timestamp: Date.now(),
    status: 'validated',
    product: product || 'analysis',
  }
  writeState(orderId, state)
  console.log(`[FLOW] webhook validated orderId=${orderId} product=${state.product}`)
}

// Called by analyze/poster — atomic lock
export function markPaymentProcessing(orderId: string): boolean {
  const state = readState(orderId)
  if (!state) {
    console.log(`[FLOW] markPaymentProcessing: no state for orderId=${orderId}`)
    return false
  }
  if (state.status !== 'validated') {
    console.log(`[FLOW] markPaymentProcessing: wrong status=${state.status} for orderId=${orderId}`)
    return false
  }
  state.status = 'processing'
  writeState(orderId, state)
  console.log(`[FLOW] state after processing: processing orderId=${orderId}`)
  return true
}

// GET /api/payment-status?session=ls_TIMESTAMP
// Returns orderId when a payment is validated — frontend uses orderId from here on
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const session = req.query.session as string
  if (!session) return res.status(400).json({ error: 'Missing session' })

  // Extract timestamp from session to find payments in that time window
  const sessionTs = parseInt(session.replace('ls_', ''))
  if (isNaN(sessionTs)) return res.json({ validated: false, processing: false, orderId: null })

  // Scan for a payment validated AFTER the session was created (within 10 min)
  try {
    const files = fs.readdirSync(STATE_DIR).filter(f => f.startsWith('order_') && f.endsWith('.json'))
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(STATE_DIR, file), 'utf8')
        const state: PaymentState = JSON.parse(raw)
        // Payment must have been validated AFTER the session was opened
        // and within 10 minutes
        if (
          state.timestamp >= sessionTs &&
          state.timestamp <= sessionTs + 10 * 60 * 1000
        ) {
          const validated = state.status === 'validated'
          const processing = state.status === 'processing'
          if (validated || processing) {
            console.log(`[FLOW] polling session=${session} → matched orderId=${state.orderId} status=${state.status}`)
            return res.json({ validated, processing, orderId: state.orderId })
          }
        }
      } catch {}
    }
  } catch {}

  return res.json({ validated: false, processing: false, orderId: null })
})

export function consumeValidatedPayment(orderId: string): void {
  try {
    const file = getStatePath(orderId)
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      console.log(`[FLOW] consumed orderId=${orderId}`)
    }
  } catch (e) {
    console.error('[PaymentStatus] Clear error:', e)
  }
}
