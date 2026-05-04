import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import sharp from 'sharp'

const REPORTS_DIR = path.join(__dirname, '../../reports')
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })

const PROJECT_ROOT = path.resolve(__dirname, '../../')
const BASEIMAGE_PATH = path.join(PROJECT_ROOT, 'src/assets/BASEIMAGE.png')
const FAL_API_KEY = process.env.FAL_API_KEY

// Upload image buffer to fal.ai storage → returns public URL
async function uploadToFal(buffer: Buffer, filename: string, mimeType = 'image/jpeg'): Promise<string> {
  const blob = new Blob([buffer], { type: mimeType })
  const formData = new FormData()
  formData.append('file', blob, filename)

  const res = await fetch('https://fal.run/fal-ai/storage/upload', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_API_KEY}` },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`fal.ai upload failed: ${err}`)
  }

  const data = await res.json() as any
  return data.url
}

export async function generatePosterImage(data: {
  imageBase64: string[]
  colorimetry: any
  hairstyle: any
}): Promise<string> {
  const { imageBase64, colorimetry, hairstyle } = data

  const gender: string = (hairstyle?.gender || colorimetry?.gender || 'female').toLowerCase()
  const isMale = gender.includes('male') || gender.includes('man') || gender.includes('hombre')

  const season = colorimetry?.season || colorimetry?.seasonSubtype || 'Soft Autumn'
  const dressColor = getDressColor(season)

  const genderInstructions = isMale
    ? `Insert a new male person seated on the marble stairs next to Stanley Tucci. He wears a formal black tuxedo with bow tie. Use the exact face from the reference photo.`
    : `Insert a new female person standing on the left side of the stairs near Anne Hathaway. She wears an elegant long gala dress in ${dressColor}. Use the exact face from the reference photo.`

  const prompt = `Movie poster photo editing. The Devil Wears Prada 2 poster. Meryl Streep top center in red dress, Anne Hathaway left in white suit, Emily Blunt right in black dress, Stanley Tucci seated bottom center. Task: ${genderInstructions} Rules: preserve exact face from reference, keep all original cast untouched, keep all text and title intact, no watermarks, photorealistic result.`

  // Resize BASEIMAGE to 1080px
  const baseBuffer = await sharp(BASEIMAGE_PATH)
    .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()

  // Resize user image to 512px for face reference — smaller = faster
  const userRaw = imageBase64[0].replace(/^data:image\/\w+;base64,/, '')
  const userBuffer = await sharp(Buffer.from(userRaw, 'base64'))
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  console.log(`[Poster] User face: resized to 512px, base: 1080px`)

  // Upload both to fal.ai storage for fast processing
  console.log('[Poster] Uploading images to fal.ai storage...')
  const [baseUrl, userUrl] = await Promise.all([
    uploadToFal(baseBuffer, 'base.jpg'),
    uploadToFal(userBuffer, 'face.jpg'),
  ])
  console.log('[Poster] Upload done, submitting to flux-pro/kontext...')

  const submitRes = await fetch('https://queue.fal.run/fal-ai/flux-pro/kontext', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: baseUrl,
      image_urls: [userUrl],
      num_inference_steps: 16,   // reduced for speed
      guidance_scale: 3.0,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '2',
    }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`fal.ai submit failed: ${err}`)
  }

  const { request_id } = await submitRes.json() as any
  console.log(`[Poster] Submitted request_id=${request_id}`)

  // Poll — 4 min max
  const resultUrl = await pollFalResult(request_id, 240000)
  console.log(`[Poster] Completed, downloading...`)

  const imgRes = await fetch(resultUrl)
  if (!imgRes.ok) throw new Error('Failed to download poster')
  const raw = Buffer.from(await imgRes.arrayBuffer())

  const final = await sharp(raw)
    .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const filename = `poster-${uuid()}.jpg`
  fs.writeFileSync(path.join(REPORTS_DIR, filename), final)
  console.log(`[Poster] Saved: ${filename} (${Math.round(final.length / 1024)}KB)`)
  return `/reports/${filename}`
}

async function pollFalResult(requestId: string, maxWaitMs = 240000): Promise<string> {
  const start = Date.now()
  const statusUrl = `https://queue.fal.run/fal-ai/flux-pro/kontext/requests/${requestId}`

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 5000))
    try {
      const statusRes = await fetch(`${statusUrl}/status`, {
        headers: { 'Authorization': `Key ${FAL_API_KEY}` },
      })
      if (!statusRes.ok) continue
      const status = await statusRes.json() as any
      const elapsed = Math.round((Date.now() - start) / 1000)
      console.log(`[Poster] fal.ai: ${status.status} (${elapsed}s)`)

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(statusUrl, {
          headers: { 'Authorization': `Key ${FAL_API_KEY}` },
        })
        const result = await resultRes.json() as any
        const url = result?.images?.[0]?.url
        if (!url) throw new Error('No image URL in result')
        return url
      }
      if (status.status === 'FAILED') {
        throw new Error(`fal.ai failed: ${JSON.stringify(status)}`)
      }
    } catch (e: any) {
      if (e.message.includes('failed') || e.message.includes('No image')) throw e
    }
  }
  throw new Error(`fal.ai timed out after ${Math.round(maxWaitMs / 1000)}s`)
}

function getDressColor(season: string): string {
  const s = season.toLowerCase()
  if (s.includes('soft autumn') || s.includes('otoño suave')) return 'warm terracotta'
  if (s.includes('autumn') || s.includes('otoño')) return 'deep burgundy'
  if (s.includes('soft summer') || s.includes('verano suave')) return 'dusty rose'
  if (s.includes('summer') || s.includes('verano')) return 'soft lavender'
  if (s.includes('spring') || s.includes('primavera')) return 'warm coral'
  if (s.includes('winter') || s.includes('invierno')) return 'deep emerald'
  return 'midnight navy'
}
