import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { runAnalysis } from '../services/analysisService'
import { generatePDF } from '../services/pdfService'
import { generatePosterImage } from '../services/imageService'
import { markPaymentProcessing, consumeValidatedPayment } from './paymentStatus'

export const analyzeRouter = Router()

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${uuid()}-${Date.now()}${path.extname(file.originalname)}`),
})

const fileFilter = (_: any, file: any, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/tiff', 'image/avif']
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true)
  else cb(new Error('Invalid file type'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
})

export function registerValidatedPayment(_transactionId: string) {}

analyzeRouter.post(
  '/',
  upload.fields([
    { name: 'image0', maxCount: 1 },
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const uploadedFiles: string[] = []

    try {
      const { transactionId, lang = 'en' } = req.body

      console.log(`[Analyze] Request — transactionId: ${transactionId}`)

      if (!transactionId) {
        return res.status(402).json({ error: 'Payment required.' })
      }

      // Single gate: validates AND locks atomically (validated → processing)
      const locked = markPaymentProcessing(transactionId)

      if (!locked) {
        if (process.env.NODE_ENV === 'production') {
          console.error(`[Analyze] Gate failed (invalid or already processing): ${transactionId}`)
          return res.status(409).json({ error: 'Payment not validated or already processing.' })
        }
        console.warn(`[DEV] Bypassing payment gate for: ${transactionId}`)
      }

      console.log(`[Analyze] Processing started: ${transactionId}`)

      const files = req.files as Record<string, any[]>
      const img0 = files?.image0?.[0]
      const img1 = files?.image1?.[0]
      const img2 = files?.image2?.[0]

      if (!img0 || !img1 || !img2) {
        return res.status(400).json({ error: 'All 3 images are required.' })
      }

      const imagePaths = [img0.path, img1.path, img2.path]
      uploadedFiles.push(...imagePaths)

      // ── AI ANALYSIS ─────────────────────────────────────────
      const analysisResult = await runAnalysis(imagePaths)

      // ── PDF (OBLIGATORIO) ────────────────────────────────────
      console.log('[Analyze] Generating PDF...')
      const reportUrl = await generatePDF({ ...analysisResult, lang })

      if (!reportUrl) {
        throw new Error('PDF generation failed — no URL returned')
      }
      console.log(`[Analyze] PDF OK: ${reportUrl}`)

      // ── POSTER (OPCIONAL) ────────────────────────────────────
      let posterUrl: string | null = null
      try {
        console.log('[Analyze] Generating poster...')
        posterUrl = await generatePosterImage({
          imageBase64: analysisResult.imageBase64,
          colorimetry: analysisResult.colorimetry,
          hairstyle: analysisResult.hairstyle,
        })
        console.log(`[Analyze] Poster OK: ${posterUrl}`)
      } catch (posterErr: any) {
        console.error('[Analyze] Poster failed (non-critical):', posterErr.message)
        posterUrl = null
      }

      // ── CLEANUP ──────────────────────────────────────────────
      await Promise.all(imagePaths.map(p => fs.promises.unlink(p).catch(() => {})))

      // ── CONSUME — only after PDF confirmed ──────────────────
      if (locked && reportUrl) {
        consumeValidatedPayment(transactionId)
      }

      console.log(`[Analyze] Done — pdf:${!!reportUrl} poster:${!!posterUrl}`)
      return res.json({ success: true, reportUrl, posterUrl })

    } catch (err: any) {
      await Promise.all(uploadedFiles.map(p => fs.promises.unlink(p).catch(() => {})))
      console.error('[Analyze Error]', err.message)
      return res.status(500).json({ error: 'Analysis failed. Please try again.' })
    }
  }
)
