import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import dotenv from 'dotenv'
import { analyzeRouter } from './routes/analyze'
import { webhookRouter } from './routes/webhook'
import { reportRouter } from './routes/report'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many requests',
})
app.use('/api/', limiter)

// Raw body for Paddle webhooks
app.use('/webhooks', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '50mb' }))

// Static reports (protected by token in production)
app.use('/reports', express.static(path.join(__dirname, '../reports')))

// Routes
app.use('/api/analyze', analyzeRouter)
app.use('/webhooks', webhookRouter)
app.use('/api/report', reportRouter)

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'Miroir API' }))

app.listen(PORT, () => {
  console.log(`✦ Miroir API running on port ${PORT}`)
})

export default app
