import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'

export const reportRouter = Router()

const REPORTS_DIR = path.join(__dirname, '../../reports')

reportRouter.get('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params
  // Security: no path traversal
  const safeName = path.basename(filename)
  if (!safeName.endsWith('.pdf') || safeName.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  const filePath = path.join(REPORTS_DIR, safeName)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' })
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="miroir-report.pdf"`)
  return res.sendFile(filePath)
})
