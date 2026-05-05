import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { runAnalysis } from '../services/analysisService'
import { generatePDF } from '../services/pdfService'
import { isRecentPaymentValidated, consumeValidatedPayment } from './paymentStatus'
import { createJob, completeJob, failJob } from './jobStatus'

export const analyzeRouter = Router()

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

export function registerValidatedPayment(_id: string) {}

analyzeRouter.post(
  '/',
  upload.fields([{ name: 'image0', maxCount: 1 }]),
  async (req: Request, res: Response) => {
    const uploadedFiles: string[] = []
    try {
      const { transactionId, lang = 'en' } = req.body
      console.log(`[FLOW] analyze start orderId=${transactionId}`)

      if (!transactionId) {
        return res.status(402).json({ error: 'Payment required.' })
      }

      const locked = isRecentPaymentValidated(transactionId)
      if (!locked) {
        if (process.env.NODE_ENV === 'production') {
          console.error(`[FLOW] analyze gate failed orderId=${transactionId}`)
          return res.status(409).json({ error: 'Payment not validated or already processing.' })
        }
        console.warn(`[DEV] Bypassing payment gate for: ${transactionId}`)
      }

      const files = req.files as Record<string, any[]>
      const img0 = files?.image0?.[0]
      if (!img0) return res.status(400).json({ error: 'Image is required.' })

      uploadedFiles.push(img0.path)

      // Create job and respond immediately — don't wait for processing
      const jobId = uuid()
      createJob(jobId)

      // Respond immediately with jobId
      res.json({ success: true, jobId })

      // Process in background (after response sent)
      setImmediate(async () => {
        try {
          console.log(`[FLOW] background processing jobId=${jobId}`)
          const analysisResult = await runAnalysis([img0.path], lang)

          console.log('[FLOW] generating PDF...')
          const reportUrl = await generatePDF({ ...analysisResult, lang })
          if (!reportUrl) throw new Error('PDF generation failed')
          console.log(`[FLOW] PDF done: ${reportUrl}`)

          await fs.promises.unlink(img0.path).catch(() => {})
          if (locked) consumeValidatedPayment(transactionId)

          completeJob(jobId, { reportUrl })
        } catch (err: any) {
          await fs.promises.unlink(img0.path).catch(() => {})
          console.error('[Analyze Error]', err.message)
          failJob(jobId, err.message)
        }
      })

    } catch (err: any) {
      await Promise.all(uploadedFiles.map(p => fs.promises.unlink(p).catch(() => {})))
      console.error('[Analyze Error]', err.message)
      return res.status(500).json({ error: 'Analysis failed. Please try again.' })
    }
  }
)
