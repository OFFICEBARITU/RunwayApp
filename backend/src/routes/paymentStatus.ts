import { Router, Request, Response } from 'express'

export const paymentStatusRouter = Router()

// Store validated order IDs and session IDs
const validatedPayments = new Set<string>()
let lastValidatedOrderId = ''

export function markPaymentValidated(orderId: string, sessionId?: string) {
  validatedPayments.add(orderId)
  lastValidatedOrderId = orderId
  if (sessionId) validatedPayments.add(sessionId)
  // Clean up after 1 hour
  setTimeout(() => {
    validatedPayments.delete(orderId)
    if (sessionId) validatedPayments.delete(sessionId)
  }, 3600000)
}

// GET /api/payment-status?session=xxx
paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })

  // Check by session ID or if any payment was validated in last 30 seconds
  const validated = validatedPayments.has(sessionId) || 
    (lastValidatedOrderId !== '' && Date.now() - parseInt(sessionId.replace('ls_', '')) < 120000)

  return res.json({ validated, orderId: validated ? lastValidatedOrderId : null })
})

// Check if any payment was validated recently (within 2 minutes of sessionId timestamp)
export function isRecentPaymentValidated(sessionId: string): boolean {
  if (lastValidatedOrderId === '') return false
  const sessionTimestamp = parseInt(sessionId.replace('ls_', ''))
  if (isNaN(sessionTimestamp)) return false
  return Date.now() - sessionTimestamp < 120000
}

// Consume the last validated payment (one-use)
export function consumeValidatedPayment(): void {
  if (lastValidatedOrderId) {
    validatedPayments.delete(lastValidatedOrderId)
    lastValidatedOrderId = ''
  }
}
