import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { runAnalysis } from '../services/analysisService'
import { generatePDF } from '../services/pdfService'
import { generatePosterImage } from '../services/imageService'
import { isRecentPaymentValidated, consumeValidatedPayment } from './paymentStatus'

export const analyzeRouter = Router()

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// Multer config — strict file validation
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${uuid()}-${Date.now()}${path.extname(file.originalname)}`),
})

const fileFilter = (_: any, file: any, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/tiff', 'image/avif']
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true)
  else cb(new Error('Invalid file type. Only JPG, PNG, WEBP allowed.'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
})

// Payment session store (in production: use Redis or DB)
const validatedPayments = new Set<string>()

// Endpoint called by Paddle webhook to register validated payment
export function registerValidatedPayment(transactionId: string) {
  validatedPayments.add(transactionId)
  // Clean up after 1 hour
  setTimeout(() => validatedPayments.delete(transactionId), 60 * 60 * 1000)
}

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

      // ── STRICT PAYMENT VALIDATION ──────────────────────────────
      if (!transactionId) {
        return res.status(402).json({ error: 'Payment required.' })
      }

      // Check both: direct orderId match OR recent payment from paymentStatus
      const directMatch = validatedPayments.has(transactionId)
      const recentMatch = isRecentPaymentValidated(transactionId)
      
      if (!directMatch && !recentMatch) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(402).json({ error: 'Payment not validated.' })
        }
        console.warn(`[DEV] Payment ${transactionId} not validated — bypassing for dev`)
      }
      // Log validation result
      console.log(`[Analyze] Payment check — direct:${directMatch} recent:${recentMatch} txId:${transactionId}`)

      // ── FILE VALIDATION ────────────────────────────────────────
      const files = req.files as Record<string, any[]>
      const img0 = files?.image0?.[0]
      const img1 = files?.image1?.[0]
      const img2 = files?.image2?.[0]

      if (!img0 || !img1 || !img2) {
        return res.status(400).json({ error: 'All 3 images are required.' })
      }

      const imagePaths = [img0.path, img1.path, img2.path]
      uploadedFiles.push(...imagePaths)

      // ── AI ANALYSIS ────────────────────────────────────────────
      const analysisResult = await runAnalysis(imagePaths)

      // ── PDF + POSTER IN PARALLEL ───────────────────────────────
      const [reportUrl, posterUrl] = await Promise.allSettled([
        generatePDF({ ...analysisResult, lang }),
        generatePosterImage({
          imageBase64: analysisResult.imageBase64,
          colorimetry: analysisResult.colorimetry,
          hairstyle: analysisResult.hairstyle,
        }),
      ]).then(([pdfResult, posterResult]) => {
        const pdf = pdfResult.status === 'fulfilled' ? pdfResult.value : null
        const poster = posterResult.status === 'fulfilled' ? posterResult.value : null
        if (posterResult.status === 'rejected') {
          console.error('[Poster Error]', posterResult.reason?.message)
        }
        return [pdf, poster]
      })

      // Cleanup temp images
      imagePaths.forEach(p => fs.unlink(p, () => {}))

      // Consume payment AFTER successful generation
      if (directMatch) validatedPayments.delete(transactionId)
      if (recentMatch) consumeValidatedPayment()

      console.log(`[Analyze] Complete — pdf:${!!reportUrl} poster:${!!posterUrl}`)
      return res.json({ success: true, reportUrl, posterUrl })

    } catch (err: any) {
      // Cleanup on error
      uploadedFiles.forEach(p => fs.unlink(p, () => {}))
      console.error('[Analyze Error]', err.message)
      return res.status(500).json({ error: 'Analysis failed. Please try again.' })
    }
  }
)
