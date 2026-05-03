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
  product: 'analysis' | 'poster'
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

export function markPaymentValidated(orderId: string, sessionId?: string, product?: string) {
  try {
    const id = (sessionId && sessionId !== 'undefined') ? sessionId : orderId
    const state: PaymentState = {
      orderId,
      sessionId: id,
      timestamp: Date.now(),
      status: 'validated',
      product: (product === 'poster' ? 'poster' : 'analysis') as 'analysis' | 'poster',
    }
    writeState(id, state)
    // Also write by orderId as fallback key
    if (id !== orderId) {
      writeState(orderId, state)
    }
    console.log(`[PaymentStatus] validated: sessionId=${id} orderId=${orderId} product=${state.product}`)
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
    // Update orderId file too
    if (state.orderId !== sessionId) {
      writeState(state.orderId, state)
    }
    console.log(`[PaymentStatus] processing: ${sessionId}`)
    return true
  } catch (e) {
    console.error('[PaymentStatus] Processing mark error:', e)
    return false
  }
}

// GET /api/payment-status?session=xxx — read only
// Also scans recent payment files when sessionId doesn't match (LS doesn't propagate custom data in test mode)
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })

  let state = readState(sessionId)

  // Fallback: scan all session files for a recently validated payment
  if (!state) {
    try {
      const files = fs.readdirSync(STATE_DIR).filter(f => f.endsWith('.json'))
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(STATE_DIR, file), 'utf8')
          const s = JSON.parse(raw) as PaymentState
          // Match if created within 5 minutes and status is validated
          if ((s.status === 'validated') && (Date.now() - s.timestamp < 5 * 60 * 1000)) {
            state = s
            console.log(`[PaymentStatus] Fallback match: ${s.orderId} for session ${sessionId}`)
            break
          }
        } catch {}
      }
    } catch {}
  }

  const validated = state?.status === 'validated'
  const processing = state?.status === 'processing'

  if (validated) console.log(`[PaymentStatus] Polling: validated ${sessionId} → orderId:${state?.orderId}`)
  if (processing) console.log(`[PaymentStatus] Polling: processing ${sessionId}`)

  return res.json({ validated, processing, orderId: state?.orderId || null })
})

export function getPaymentProduct(sessionId: string): string {
  const state = readState(sessionId)
  return state?.product || 'analysis'
}

export function consumeValidatedPayment(sessionId: string): void {
  try {
    const state = readState(sessionId)
    const file = getStatePath(sessionId)
    if (fs.existsSync(file)) { fs.unlinkSync(file) }
    // Also clean orderId file
    if (state && state.orderId !== sessionId) {
      const orderFile = getStatePath(state.orderId)
      if (fs.existsSync(orderFile)) { fs.unlinkSync(orderFile) }
    }
    console.log(`[PaymentStatus] Consumed: ${sessionId}`)
  } catch (e) {
    console.error('[PaymentStatus] Clear error:', e)
  }
}
