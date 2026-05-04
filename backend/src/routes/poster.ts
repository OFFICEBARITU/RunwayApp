import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import sharp from 'sharp'
import { markPaymentProcessing, consumeValidatedPayment } from './paymentStatus'
import { createJob, setJobFalRequestId, failJob, completeJob } from './jobStatus'


export const posterRouter = Router()

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const PROJECT_ROOT = path.resolve(__dirname, '../../')
const BASEIMAGE_PATH = path.join(PROJECT_ROOT, 'src/assets/BASEIMAGE.png')
const FAL_API_KEY = process.env.FAL_API_KEY

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${uuid()}-${Date.now()}${path.extname(file.originalname)}`),
})

const fileFilter = (_: any, file: any, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) cb(null, true)
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
      if (!transactionId) return res.status(402).json({ error: 'Payment required.' })

      const locked = markPaymentProcessing(transactionId)
      if (!locked && process.env.NODE_ENV === 'production') {
        return res.status(409).json({ error: 'Payment not validated or already processing.' })
      }

      const files = req.files as Record<string, any[]>
      const img0 = files?.image0?.[0]
      if (!img0) return res.status(400).json({ error: 'Image is required.' })
      uploadedFiles.push(img0.path)

      // Detect gender from image using Claude
      const genderPrompt = 'Look at this photo. Is the person male or female? Reply with ONLY one word: male or female.'
      let gender = 'female'
      try {
        const buf = await sharp(img0.path).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer()
        const b64 = buf.toString('base64')
        const gRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: genderPrompt }] }] }),
        })
        const gData: any = await gRes.json()
        const gText = gData.content?.[0]?.text?.toLowerCase() || ''
        if (gText.includes('male')) gender = 'male'
        console.log(`[Poster] Gender detected: ${gender}`)
      } catch {}

      const isMale = gender === 'male'
      console.log(`[Poster] Using easel-ai/advanced-face-swap — gender: ${gender}`)

      // Resize to base64 — kontext accepts base64 directly
      const baseBuffer = await sharp(BASEIMAGE_PATH)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      const userBuffer = await sharp(img0.path)
        .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer()

      const baseDataUrl = `data:image/jpeg;base64,${baseBuffer.toString('base64')}`
      const userDataUrl = `data:image/jpeg;base64,${userBuffer.toString('base64')}`
      console.log(`[Poster] Base: ${Math.round(baseBuffer.length/1024)}KB, User: ${Math.round(userBuffer.length/1024)}KB`)

      // Submit to Replicate lucataco/faceswap
      const REPLICATE_KEY = process.env.REPLICATE_API_KEY
      const submitRes = await fetch('https://api.replicate.com/v1/models/lucataco/faceswap/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait=30',
        },
        body: JSON.stringify({
          input: {
            target_image: baseDataUrl,
            swap_image: userDataUrl,
          }
        }),
      })

      if (!submitRes.ok) {
        const err = await submitRes.text()
        throw new Error(`Replicate submit failed: ${err}`)
      }

      const prediction = await submitRes.json() as any
      const request_id = prediction.id
      console.log(`[Poster] Replicate submitted id=${request_id} status=${prediction.status}`)

      // If already done (Prefer: wait=30 may return synchronously)
      if (prediction.status === 'succeeded' && prediction.output) {
        const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
        const imgRes = await fetch(imageUrl)
        const raw = Buffer.from(await imgRes.arrayBuffer())
        const final = await sharp(raw).resize(1080, 1920, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
        const filename = `poster-${uuid()}.jpg`
        fs.writeFileSync(path.join(REPORTS_DIR, filename), final)
        const posterUrl = `/reports/${filename}`
        const jobId = uuid()
        createJob(jobId)
        completeJob(jobId, { posterUrl })
        if (locked) consumeValidatedPayment(transactionId)
        await fs.promises.unlink(img0.path).catch(() => {})
        console.log(`[Poster] Completed synchronously: ${filename}`)
        return res.json({ success: true, jobId })
      }

      // Create job — polling will check Replicate directly
      const jobId = uuid()
      createJob(jobId)
      setJobFalRequestId(jobId, request_id, transactionId)

      await fs.promises.unlink(img0.path).catch(() => {})
      if (locked) consumeValidatedPayment(transactionId)

      res.json({ success: true, jobId })

    } catch (err: any) {
      await Promise.all(uploadedFiles.map(p => fs.promises.unlink(p).catch(() => {})))
      console.error('[Poster Error]', err.message)
      return res.status(500).json({ error: 'Poster generation failed.' })
    }
  }
)
