import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { v4 as uuid } from 'uuid'

export const jobStatusRouter = Router()

const JOBS_DIR = path.join(__dirname, '../../jobs')
const REPORTS_DIR = path.join(__dirname, '../../reports')
if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true })
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })


interface JobState {
  status: 'processing' | 'done' | 'error'
  reportUrl?: string
  posterUrl?: string
  falRequestId?: string
  transactionId?: string
  error?: string
  createdAt: number
}

function getJobPath(jobId: string) { return path.join(JOBS_DIR, `${jobId}.json`) }

function readJob(jobId: string): JobState | null {
  try {
    const file = getJobPath(jobId)
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch { return null }
}

function writeJob(jobId: string, state: JobState): void {
  fs.writeFileSync(getJobPath(jobId), JSON.stringify(state))
}

export function createJob(jobId: string): void {
  writeJob(jobId, { status: 'processing', createdAt: Date.now() })
}

export function setJobFalRequestId(jobId: string, falRequestId: string, transactionId: string): void {
  const state = readJob(jobId) || { status: 'processing', createdAt: Date.now() }
  writeJob(jobId, { ...state, falRequestId, transactionId } as JobState)
  console.log(`[Job] fal request_id saved: ${falRequestId} for job ${jobId}`)
}

export function completeJob(jobId: string, result: { reportUrl?: string; posterUrl?: string }): void {
  writeJob(jobId, { status: 'done', ...result, createdAt: Date.now() })
  console.log(`[Job] Done: ${jobId}`)
  setTimeout(() => { try { fs.unlinkSync(getJobPath(jobId)) } catch {} }, 3 * 60 * 60 * 1000)
}

export function failJob(jobId: string, error: string): void {
  const state = readJob(jobId) || { status: 'processing', createdAt: Date.now() }
  writeJob(jobId, { ...state, status: 'error', error } as JobState)
  console.log(`[Job] Failed: ${jobId} — ${error}`)
}

const REPLICATE_KEY = process.env.REPLICATE_API_KEY

// Check Replicate status and download result if completed
async function checkReplicateStatus(predictionId: string): Promise<{ done: boolean; posterUrl?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_KEY}` }
    })
    if (!res.ok) return { done: false }

    const prediction = await res.json() as any
    console.log(`[Job] Replicate status: ${prediction.status} for ${predictionId}`)

    if (prediction.status === 'succeeded') {
      const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      if (!imageUrl) return { done: true, error: 'No image URL in result' }

      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) return { done: true, error: 'Failed to download poster' }
      const raw = Buffer.from(await imgRes.arrayBuffer())
      const final = await sharp(raw).resize(1080, 1920, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
      const filename = `poster-${uuid()}.jpg`
      fs.writeFileSync(path.join(REPORTS_DIR, filename), final)
      console.log(`[Job] Poster saved: ${filename} (${Math.round(final.length / 1024)}KB)`)
      return { done: true, posterUrl: `/reports/${filename}` }
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return { done: true, error: `Replicate job ${prediction.status}: ${prediction.error || ''}` }
    }

    return { done: false }
  } catch (e: any) {
    console.error('[Job] Replicate check error:', e.message)
    return { done: false }
  }
}

// GET /api/job-status/fal?requestId=xxx — check Replicate directly by prediction id
jobStatusRouter.get('/fal', async (req: Request, res: Response) => {
  const predictionId = req.query.requestId as string
  if (!predictionId) return res.status(400).json({ error: 'Missing requestId' })
  try {
    const result = await checkReplicateStatus(predictionId)
    return res.json(result)
  } catch (e: any) {
    return res.json({ done: false, error: e.message })
  }
})

// GET /api/job-status?id=xxx
jobStatusRouter.get('/', async (req: Request, res: Response) => {
  const jobId = req.query.id as string
  if (!jobId) return res.status(400).json({ error: 'Missing job id' })

  try {
    const state = readJob(jobId)
    if (!state) return res.json({ status: 'processing' })

    // If already done or error, return immediately
    if (state.status === 'done' || state.status === 'error') {
      console.log(`[Job] Polling ${jobId} — status: ${state.status}`)
      return res.json(state)
    }

    // If has fal request_id, check fal.ai directly
    if (state.falRequestId) {
      const falResult = await checkReplicateStatus(state.falRequestId)
      if (falResult.done) {
        if (falResult.posterUrl) {
          const newState = { ...state, status: 'done' as const, posterUrl: falResult.posterUrl }
          writeJob(jobId, newState)
          setTimeout(() => { try { fs.unlinkSync(getJobPath(jobId)) } catch {} }, 3 * 60 * 60 * 1000)
          console.log(`[Job] Poster complete: ${jobId}`)
          return res.json(newState)
        } else if (falResult.error) {
          const newState = { ...state, status: 'error' as const, error: falResult.error }
          writeJob(jobId, newState)
          return res.json(newState)
        }
      }
    }

    console.log(`[Job] Polling ${jobId} — status: processing, falRequestId: ${state.falRequestId || 'none'}`)
    return res.json({ status: 'processing', falRequestId: state.falRequestId || null })

  } catch {
    return res.json({ status: 'processing' })
  }
})
