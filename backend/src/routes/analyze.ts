import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { runAnalysis } from '../services/analysisService'
import { generatePDF } from '../services/pdfService'

export const analyzeRouter = Router()

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// Multer config — strict file validation
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${uuid()}-${Date.now()}${path.extname(file.originalname)}`),
})

const fileFilter = (_: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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

      if (!validatedPayments.has(transactionId)) {
        // For sandbox/dev: allow if env flag is set
        if (process.env.NODE_ENV === 'production') {
          return res.status(402).json({ error: 'Payment not validated.' })
        }
        // In development, log warning but continue
        console.warn(`[DEV] Payment ${transactionId} not in validated set — bypassing for dev`)
      }
      // Remove used payment token (one-use)
      validatedPayments.delete(transactionId)

      // ── FILE VALIDATION ────────────────────────────────────────
      const files = req.files as Record<string, Express.Multer.File[]>
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

      // ── PDF GENERATION ─────────────────────────────────────────
      const reportUrl = await generatePDF({
        ...analysisResult,
        lang,
      })

      // Cleanup temp images
      imagePaths.forEach(p => fs.unlink(p, () => {}))

      return res.json({ success: true, reportUrl })

    } catch (err: any) {
      // Cleanup on error
      uploadedFiles.forEach(p => fs.unlink(p, () => {}))
      console.error('[Analyze Error]', err.message)
      return res.status(500).json({ error: 'Analysis failed. Please try again.' })
    }
  }
)
