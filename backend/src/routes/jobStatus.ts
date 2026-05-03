import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const jobStatusRouter = Router()

const JOBS_DIR = path.join(__dirname, '../../jobs')
if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true })

interface JobState {
  status: 'processing' | 'done' | 'error'
  reportUrl?: string
  posterUrl?: string
  error?: string
  createdAt: number
}

export function createJob(jobId: string): void {
  const state: JobState = { status: 'processing', createdAt: Date.now() }
  fs.writeFileSync(path.join(JOBS_DIR, `${jobId}.json`), JSON.stringify(state))
}

export function completeJob(jobId: string, result: { reportUrl?: string; posterUrl?: string }): void {
  const state: JobState = { status: 'done', ...result, createdAt: Date.now() }
  fs.writeFileSync(path.join(JOBS_DIR, `${jobId}.json`), JSON.stringify(state))
  console.log(`[Job] Done: ${jobId}`)
  // Clean up after 1 hour
  setTimeout(() => {
    try { fs.unlinkSync(path.join(JOBS_DIR, `${jobId}.json`)) } catch {}
  }, 60 * 60 * 1000)
}

export function failJob(jobId: string, error: string): void {
  const state: JobState = { status: 'error', error, createdAt: Date.now() }
  fs.writeFileSync(path.join(JOBS_DIR, `${jobId}.json`), JSON.stringify(state))
  console.log(`[Job] Failed: ${jobId} — ${error}`)
}

// GET /api/job-status?id=xxx
jobStatusRouter.get('/', (req: Request, res: Response) => {
  const jobId = req.query.id as string
  if (!jobId) return res.status(400).json({ error: 'Missing job id' })

  try {
    const file = path.join(JOBS_DIR, `${jobId}.json`)
    if (!fs.existsSync(file)) return res.json({ status: 'processing' })
    const state: JobState = JSON.parse(fs.readFileSync(file, 'utf8'))
    return res.json(state)
  } catch {
    return res.json({ status: 'processing' })
  }
})
