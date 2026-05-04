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
const REPORTS_DIR = path.join(__dirname, '../../reports')
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })

const BACKEND_URL = 'https://runway-backend-4qmw.onrender.com'
const REPLICATE_KEY = process.env.REPLICATE_API_KEY

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
    const tempFiles: string[] = []

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

      // Detect gender using Claude
      let gender = 'female'
      try {
        const buf = await sharp(img0.path).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer()
        const gRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 10,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } },
                { type: 'text', text: 'Is this person male or female? Reply with ONE word only: male or female.' },
              ],
            }],
          }),
        })
        const gData: any = await gRes.json()
        const gText = gData.content?.[0]?.text?.toLowerCase() || ''
        if (gText.includes('male')) gender = 'male'
      } catch {}
      console.log(`[Poster] Gender detected: ${gender}`)

      // Resize images
      const baseBuffer = await sharp(BASEIMAGE_PATH)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      const userBuffer = await sharp(img0.path)
        .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer()

      console.log(`[Poster] Base: ${Math.round(baseBuffer.length / 1024)}KB, User: ${Math.round(userBuffer.length / 1024)}KB`)

      // Save temporarily as public URLs — Replicate requires public URLs
      const tempBaseFile = `temp-base-${uuid()}.jpg`
      const tempUserFile = `temp-user-${uuid()}.jpg`
      fs.writeFileSync(path.join(REPORTS_DIR, tempBaseFile), baseBuffer)
      fs.writeFileSync(path.join(REPORTS_DIR, tempUserFile), userBuffer)
      tempFiles.push(tempBaseFile, tempUserFile)

      const baseUrl = `${BACKEND_URL}/reports/${tempBaseFile}`
      const userUrl = `${BACKEND_URL}/reports/${tempUserFile}`

      console.log(`[Poster] Submitting to Replicate cdingram/face-swap...`)

      // Submit to Replicate easel/advanced-face-swap
      const submitRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'd1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111',
          input: {
            swap_image: userUrl,
            input_image: baseUrl,
          },
        }),
      })

      if (!submitRes.ok) {
        const err = await submitRes.text()
        throw new Error(`Replicate submit failed: ${err}`)
      }

      const prediction = await submitRes.json() as any
      console.log(`[Poster] Replicate submitted id=${prediction.id} status=${prediction.status}`)

      // Delete temp files after 5 minutes
      setTimeout(() => {
        tempFiles.forEach(f => fs.unlink(path.join(REPORTS_DIR, f), () => {}))
      }, 5 * 60 * 1000)

      // Create job — polling checks Replicate directly
      const jobId = uuid()
      createJob(jobId)
      setJobFalRequestId(jobId, prediction.id, transactionId)

      await fs.promises.unlink(img0.path).catch(() => {})
      if (locked) consumeValidatedPayment(transactionId)

      return res.json({ success: true, jobId })

    } catch (err: any) {
      await Promise.all(uploadedFiles.map(p => fs.promises.unlink(p).catch(() => {})))
      tempFiles.forEach(f => fs.unlink(path.join(REPORTS_DIR, f), () => {}))
      console.error('[Poster Error]', err.message)
      return res.status(500).json({ error: 'Poster generation failed.' })
    }
  }
)
