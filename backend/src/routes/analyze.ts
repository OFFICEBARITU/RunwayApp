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

// Kept only for webhook backward compat — not used for validation
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

      // Single validation path — sessionId based, disk persisted
      const isValid = isRecentPaymentValidated(transactionId)

      if (!isValid) {
        if (process.env.NODE_ENV === 'production') {
          console.error(`[Analyze] Payment NOT valid for sessionId: ${transactionId}`)
          return res.status(402).json({ error: 'Payment not validated.' })
        }
        console.warn(`[DEV] Bypassing payment validation for: ${transactionId}`)
      }

      console.log(`[Analyze] Payment valid — proceeding`)

      const files = req.files as Record<string, any[]>
      const img0 = files?.image0?.[0]
      const img1 = files?.image1?.[0]
      const img2 = files?.image2?.[0]

      if (!img0 || !img1 || !img2) {
        return res.status(400).json({ error: 'All 3 images are required.' })
      }

      const imagePaths = [img0.path, img1.path, img2.path]
      uploadedFiles.push(...imagePaths)

      const analysisResult = await runAnalysis(imagePaths)

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
        if (pdfResult.status === 'rejected') console.error('[PDF Error]', pdfResult.reason?.message)
        if (posterResult.status === 'rejected') console.error('[Poster Error]', posterResult.reason?.message)
        return [pdf, poster]
      })

      imagePaths.forEach(p => fs.unlink(p, () => {}))

      // Consume AFTER successful generation
      if (isValid) consumeValidatedPayment()

      console.log(`[Analyze] Done — pdf:${!!reportUrl} poster:${!!posterUrl}`)
      return res.json({ success: true, reportUrl, posterUrl })

    } catch (err: any) {
      uploadedFiles.forEach(p => fs.unlink(p, () => {}))
      console.error('[Analyze Error]', err.message)
      return res.status(500).json({ error: 'Analysis failed. Please try again.' })
    }
  }
)
