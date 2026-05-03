import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'

export const reportRouter = Router()

const REPORTS_DIR = path.join(__dirname, '../../reports')

reportRouter.get('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params
  // Security: no path traversal
  const safeName = path.basename(filename)
  const validExt = safeName.endsWith('.pdf') || safeName.endsWith('.png')
  if (!validExt || safeName.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  // Set correct content type
  const contentType = safeName.endsWith('.png') ? 'image/png' : 'application/pdf'
  const disposition = safeName.endsWith('.png') ? 'attachment; filename="runway-poster.png"' : 'attachment; filename="miroir-report.pdf"'
  const filePath = path.join(REPORTS_DIR, safeName)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' })
  }
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', disposition)
  return res.sendFile(filePath)
})
