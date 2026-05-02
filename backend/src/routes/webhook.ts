import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { registerValidatedPayment } from './analyze'

export const webhookRouter = Router()

// ─── LEMON SQUEEZY WEBHOOK ───────────────────────────────────────────────────

function verifyLemonSqueezySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(rawBody)
    const digest = hmac.digest('hex')
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

webhookRouter.post('/lemonsqueezy', (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Buffer
    const signature = req.headers['x-signature'] as string

    if (!signature || !process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
      console.warn('[Webhook] Missing signature or secret')
      return res.status(400).json({ error: 'Invalid request' })
    }

    const isValid = verifyLemonSqueezySignature(
      rawBody,
      signature,
      process.env.LEMONSQUEEZY_WEBHOOK_SECRET
    )

    if (!isValid) {
      console.warn('[Webhook] Invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const event = JSON.parse(rawBody.toString('utf8'))
    const eventName = event.meta?.event_name

    if (eventName === 'order_created') {
      const status = event.data?.attributes?.status
      const orderId = event.data?.id

      if (orderId && (status === 'paid' || status === 'pending')) {
        registerValidatedPayment(String(orderId))
        console.log(`[Webhook LS] Payment validated: ${orderId}`)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error('[Webhook Error]', err.message)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
})
