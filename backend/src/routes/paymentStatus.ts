import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const paymentStatusRouter = Router()

const STATE_FILE = path.join(__dirname, '../../payment-state.json')

interface PaymentState {
  orderId: string
  sessionId: string
  timestamp: number
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

export function markPaymentValidated(orderId: string, sessionId?: string) {
  try {
    const state: PaymentState = {
      orderId,
      sessionId: sessionId || orderId,
      timestamp: Date.now(),
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8')
    console.log(`[PaymentStatus] Written: orderId=${orderId} sessionId=${sessionId}`)
  } catch (e) {
    console.error('[PaymentStatus] Write error:', e)
  }
}

// GET /api/payment-status?session=xxx
// SOLO LEE — no modifica estado
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })

  const state = readState()
  if (!state) return res.json({ validated: false })

  const validated = state.sessionId === sessionId

  if (validated) {
    console.log(`[PaymentStatus] Polling validated: ${sessionId}`)
  }

  return res.json({ validated, orderId: validated ? state.orderId : null })
})

// Usado por analyze.ts para validar el pago
export function isRecentPaymentValidated(sessionId: string): boolean {
  const state = readState()
  if (!state) return false
  console.log(`[PaymentStatus] Check: sessionId=${sessionId} state.sessionId=${state.sessionId}`)
  return state.sessionId === sessionId
}

// Llamado SOLO por analyze.ts tras generar PDF+poster exitosamente
export function consumeValidatedPayment(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE)
      console.log('[PaymentStatus] Consumed and cleared')
    }
  } catch (e) {
    console.error('[PaymentStatus] Clear error:', e)
  }
}
