import { Router, Request, Response } from 'express'
import { markPaymentValidated } from './paymentStatus'

export const paypalRouter = Router()

const MODE = process.env.PAYPAL_MODE || 'sandbox'
const IS_LIVE = MODE === 'live'

const PAYPAL_BASE = IS_LIVE
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

const CLIENT_ID = IS_LIVE
  ? process.env.PAYPAL_CLIENT_ID_LIVE || ''
  : process.env.PAYPAL_CLIENT_ID_SANDBOX || ''

const SECRET = IS_LIVE
  ? process.env.PAYPAL_SECRET_LIVE || ''
  : process.env.PAYPAL_SECRET_SANDBOX || ''

console.log(`[PayPal] Mode: ${MODE} | Base: ${PAYPAL_BASE}`)

async function getAccessToken(): Promise<string> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json() as any
  if (!data.access_token) throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// POST /api/create-order
paypalRouter.post('/create-order', async (req: Request, res: Response) => {
  try {
    const { product, sessionId, amount } = req.body
    const accessToken = await getAccessToken()

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: amount || '2.99' },
          custom_id: `${sessionId}|${product}`,
          description: product === 'poster'
            ? 'Runway Poster — The Devil Wears Prada 2'
            : 'Runway Image Analysis — Editorial PDF',
        }],
      }),
    })

    const order = await orderRes.json() as any
    if (!order.id) throw new Error(`Order creation failed: ${JSON.stringify(order)}`)
    console.log(`[PayPal] Order created: ${order.id} | product=${product} | session=${sessionId}`)
    return res.json({ id: order.id })
  } catch (err: any) {
    console.error('[PayPal] Create order error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/capture-order
paypalRouter.post('/capture-order', async (req: Request, res: Response) => {
  try {
    const { orderID, sessionId, product } = req.body
    const accessToken = await getAccessToken()

    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const capture = await captureRes.json() as any
    const status = capture.status
    console.log(`[PayPal] Captured: ${orderID} | status=${status} | session=${sessionId}`)

    if (status === 'COMPLETED') {
      markPaymentValidated(orderID, sessionId)
    }

    return res.json({ status, orderId: orderID })
  } catch (err: any) {
    console.error('[PayPal] Capture error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})
