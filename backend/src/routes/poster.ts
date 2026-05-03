import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import fetch from 'node-fetch'
import { generatePosterImage } from '../services/imageService'
import { markPaymentProcessing, consumeValidatedPayment } from './paymentStatus'
import { createJob, completeJob, failJob } from './jobStatus'
import sharp from 'sharp'

export const posterRouter = Router()

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${uuid()}-${Date.now()}${path.extname(file.originalname)}`),
})

const fileFilter = (_: any, file: any, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','image/gif','image/bmp','image/tiff','image/avif']
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true)
  else cb(new Error('Invalid file type'))
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 1 } })

// FIX TIMEOUT: detección de género liviana — 1 sola llamada Claude con imagen pequeña.
// Antes se corría runAnalysis() completo (colorimetría + hairstyle, ~30s) antes de fal.ai
// (~180s), superando el límite. Ahora solo detectamos género en ~3-5s.
async function detectGenderFast(imagePath: string): Promise<'male' | 'female'> {
  try {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) return 'female'

    // Resize a 300px para minimizar tokens y tiempo
    const buf = await sharp(imagePath)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer()
    const b64 = buf.toString('base64')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
            { type: 'text', text: 'Is this person male or female? Reply with only one word: male or female.' },
          ],
        }],
      }),
    })

    if (!res.ok) return 'female'
    const data: any = await res.json()
    const answer = (data.content?.[0]?.text || '').toLowerCase().trim()
    return answer.startsWith('male') ? 'male' : 'female'
  } catch {
    return 'female'
  }
}

posterRouter.post(
  '/',
  upload.fields([{ name: 'image0', maxCount: 1 }]),
  async (req: Request, res: Response) => {
    const uploadedFiles: string[] = []
    try {
      const { transactionId } = req.body
      console.log(`[FLOW] poster start orderId=${transactionId}`)

      if (!transactionId) return res.status(402).json({ error: 'Payment required.' })

      const locked = markPaymentProcessing(transactionId)
      if (!locked) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(409).json({ error: 'Payment not validated or already processing.' })
        }
        console.warn(`[DEV] Bypassing for: ${transactionId}`)
      }

      const files = req.files as Record<string, any[]>
      const img0 = files?.image0?.[0]
      if (!img0) return res.status(400).json({ error: 'Image is required.' })

      uploadedFiles.push(img0.path)

      // Create job and respond immediately
      const jobId = uuid()
      createJob(jobId)
      res.json({ success: true, jobId })

      // Process in background
      setImmediate(async () => {
        try {
          console.log(`[FLOW] background poster jobId=${jobId}`)
          const imageBuffer = fs.readFileSync(img0.path)
          const imageBase64 = [`data:image/jpeg;base64,${imageBuffer.toString('base64')}`]

          // FIX: detección rápida de género (3-5s) en lugar de análisis completo (~30s)
          console.log(`[FLOW] poster detecting gender jobId=${jobId}`)
          const gender = await detectGenderFast(img0.path)
          console.log(`[FLOW] poster gender detected: ${gender}`)

          const colorimetry = { gender }
          const hairstyle = { gender }

          const posterUrl = await generatePosterImage({
            imageBase64,
            colorimetry,
            hairstyle,
          })
          if (!posterUrl) throw new Error('Poster generation failed')
          console.log(`[FLOW] poster done: ${posterUrl}`)

          await fs.promises.unlink(img0.path).catch(() => {})
          if (locked) consumeValidatedPayment(transactionId)

          completeJob(jobId, { posterUrl })
        } catch (err: any) {
          await fs.promises.unlink(img0.path).catch(() => {})
          console.error('[Poster Error]', err.message)
          failJob(jobId, err.message)
        }
      })

    } catch (err: any) {
      await Promise.all(uploadedFiles.map(p => fs.promises.unlink(p).catch(() => {})))
      console.error('[Poster Error]', err.message)
      return res.status(500).json({ error: 'Poster generation failed.' })
    }
  }
)

export const posterRouter = Router()

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${uuid()}-${Date.now()}${path.extname(file.originalname)}`),
})

const fileFilter = (_: any, file: any, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','image/gif','image/bmp','image/tiff','image/avif']
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true)
  else cb(new Error('Invalid file type'))
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 1 } })

posterRouter.post(
  '/',
  upload.fields([{ name: 'image0', maxCount: 1 }]),
  async (req: Request, res: Response) => {
    const uploadedFiles: string[] = []
    try {
      const { transactionId } = req.body
      console.log(`[FLOW] poster start orderId=${transactionId}`)

      if (!transactionId) return res.status(402).json({ error: 'Payment required.' })

      const locked = markPaymentProcessing(transactionId)
      if (!locked) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(409).json({ error: 'Payment not validated or already processing.' })
        }
        console.warn(`[DEV] Bypassing for: ${transactionId}`)
      }

      const files = req.files as Record<string, any[]>
      const img0 = files?.image0?.[0]
      if (!img0) return res.status(400).json({ error: 'Image is required.' })

      uploadedFiles.push(img0.path)

      // Create job and respond immediately
      const jobId = uuid()
      createJob(jobId)
      res.json({ success: true, jobId })

      // Process in background
      setImmediate(async () => {
        try {
          console.log(`[FLOW] background poster jobId=${jobId}`)
          const imageBuffer = fs.readFileSync(img0.path)
          const imageBase64 = [`data:image/jpeg;base64,${imageBuffer.toString('base64')}`]

          // FIX: ejecutar análisis para obtener colorimetry y hairstyle reales
          // en lugar de pasar null, que ignoraba el género y la estación del usuario
          let colorimetry: any = null
          let hairstyle: any = null
          try {
            console.log(`[FLOW] poster running analysis for personalization jobId=${jobId}`)
            const analysisResult = await runAnalysis([img0.path])
            colorimetry = analysisResult.colorimetry ?? null
            hairstyle = analysisResult.hairstyle ?? null
          } catch (analysisErr: any) {
            // Si el análisis falla, continuamos con defaults en generatePosterImage
            console.warn(`[FLOW] poster analysis failed, using defaults: ${analysisErr.message}`)
          }

          const posterUrl = await generatePosterImage({
            imageBase64,
            colorimetry,
            hairstyle,
          })
          if (!posterUrl) throw new Error('Poster generation failed')
          console.log(`[FLOW] poster done: ${posterUrl}`)

          await fs.promises.unlink(img0.path).catch(() => {})
          if (locked) consumeValidatedPayment(transactionId)

          completeJob(jobId, { posterUrl })
        } catch (err: any) {
          await fs.promises.unlink(img0.path).catch(() => {})
          console.error('[Poster Error]', err.message)
          failJob(jobId, err.message)
        }
      })

    } catch (err: any) {
      await Promise.all(uploadedFiles.map(p => fs.promises.unlink(p).catch(() => {})))
      console.error('[Poster Error]', err.message)
      return res.status(500).json({ error: 'Poster generation failed.' })
    }
  }
)
