import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { generatePosterImage } from '../services/imageService'
import { markPaymentProcessing, consumeValidatedPayment } from './paymentStatus'
import { createJob, completeJob, failJob } from './jobStatus'
// FIX: importar runAnalysis para obtener colorimetry y hairstyle reales del usuario
import { runAnalysis } from '../services/analysisService'

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
