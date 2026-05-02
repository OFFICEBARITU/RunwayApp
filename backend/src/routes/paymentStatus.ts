import { Router, Request, Response } from 'express'

export const paymentStatusRouter = Router()

// In-memory store of validated sessions (populated by webhook)
const validatedSessions = new Set<string>()

export function markSessionValidated(sessionId: string) {
  validatedSessions.add(sessionId)
  // Clean up after 1 hour
  setTimeout(() => validatedSessions.delete(sessionId), 3600000)
}

paymentStatusRouter.get('/', (req: Request, res: Response) => {
  const sessionId = req.query.session as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session' })
  
  const validated = validatedSessions.has(sessionId)
  return res.json({ validated })
})
