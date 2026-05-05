import { Router, Request, Response } from 'express'
import { markPaymentValidated } from './paymentStatus'

export const webhookRouter = Router()

// Verify PayPal webhook signature
async function verifyPayPalWebhook(req: Request): Promise<boolean> {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID || ''
    const secret = process.env.PAYPAL_SECRET || ''
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || ''

    // Get access token
    const tokenRes = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    const tokenData = await tokenRes.json() as any
    const accessToken = tokenData.access_token

    // Verify signature
    const verifyRes = await fetch('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: req.body,
      }),
    })
    const verifyData = await verifyRes.json() as any
    return verifyData.verification_status === 'SUCCESS'
  } catch (e: any) {
    console.error('[PayPal Webhook] Verify error:', e.message)
    return false
  }
}

webhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const event = req.body
    const eventType = event?.event_type

    console.log(`[PayPal Webhook] Event: ${eventType}`)

    if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
      return res.json({ received: true })
    }

    // In production, verify signature
    if (process.env.NODE_ENV === 'production' && process.env.PAYPAL_WEBHOOK_ID) {
      const valid = await verifyPayPalWebhook(req)
      if (!valid) {
        console.error('[PayPal Webhook] Invalid signature')
        return res.status(400).json({ error: 'Invalid signature' })
      }
    }

    const capture = event.resource
    const orderId = capture?.id || capture?.supplementary_data?.related_ids?.order_id
    const customId = capture?.custom_id || ''

    // customId format: "sessionId|product"
    const [sessionId, product] = customId.split('|')

    console.log(`[PayPal Webhook] Capture: ${orderId} | session: ${sessionId} | product: ${product}`)

    if (orderId) {
      markPaymentValidated(orderId, sessionId)
    }

    return res.json({ received: true })
  } catch (err: any) {
    console.error('[PayPal Webhook] Error:', err.message)
    return res.status(500).json({ error: 'Webhook error' })
  }
})
