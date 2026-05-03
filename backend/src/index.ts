import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import dotenv from 'dotenv'
import { analyzeRouter } from './routes/analyze'
import { posterRouter } from './routes/poster'
import { webhookRouter } from './routes/webhook'
import { reportRouter } from './routes/report'
import { paymentStatusRouter } from './routes/paymentStatus'

dotenv.config()

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT || 4000

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests',
})
app.use('/api/', limiter)

app.use('/webhooks', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '50mb' }))

app.use('/reports', express.static(path.join(__dirname, '../reports')))

app.use('/api/analyze', analyzeRouter)
app.use('/api/poster', posterRouter)
app.use('/webhooks', webhookRouter)
app.use('/api/report', reportRouter)
app.use('/api/payment-status', paymentStatusRouter)

app.get('/health', (_: any, res: any) => res.json({ status: 'ok', service: 'Runway API' }))

app.listen(PORT, () => {
  console.log(`✦ Runway API running on port ${PORT}`)
})

export default app
