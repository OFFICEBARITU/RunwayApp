import { Router, Request, Response } from 'express'
import { markPaymentValidated } from './paymentStatus'

export const paypalRouter = Router()

const PAYPAL_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID || ''
  const secret = process.env.PAYPAL_SECRET || ''
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json() as any
  return data.access_token
}

// POST /api/create-order
paypalRouter.post('/create-order', async (req: Request, res: Response) => {
  try {
    const { product, sessionId, amount } = req.body
    const accessToken = await getAccessToken()

    const order = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
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
          description: product === 'poster' ? 'Runway Poster — The Devil Wears Prada 2' : 'Runway Image Analysis — Editorial PDF',
        }],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              brand_name: 'RUNWAY',
              locale: 'en-US',
              landing_page: 'LOGIN',
              user_action: 'PAY_NOW',
            },
          },
        },
      }),
    })

    const orderData = await order.json() as any
    console.log(`[PayPal] Order created: ${orderData.id} for ${product} session=${sessionId}`)
    return res.json({ id: orderData.id })
  } catch (err: any) {
    console.error('[PayPal] Create order error:', err.message)
    return res.status(500).json({ error: 'Failed to create order' })
  }
})

// POST /api/capture-order
paypalRouter.post('/capture-order', async (req: Request, res: Response) => {
  try {
    const { orderID, sessionId, product } = req.body
    const accessToken = await getAccessToken()

    const capture = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const captureData = await capture.json() as any
    const status = captureData.status
    console.log(`[PayPal] Order captured: ${orderID} status=${status} session=${sessionId}`)

    if (status === 'COMPLETED') {
      markPaymentValidated(orderID, sessionId)
    }

    return res.json({ status, orderId: orderID })
  } catch (err: any) {
    console.error('[PayPal] Capture error:', err.message)
    return res.status(500).json({ error: 'Failed to capture order' })
  }
})
