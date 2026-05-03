import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import sharp from 'sharp'

const REPORTS_DIR = path.join(__dirname, '../../reports')
const PROJECT_ROOT = path.resolve(__dirname, '../../')
const BASEIMAGE_PATH = path.join(PROJECT_ROOT, 'src/assets/BASEIMAGE.png')
const FAL_API_KEY = process.env.FAL_API_KEY

// Resize image to max dimensions, return as base64 jpeg
async function resizeToBase64(inputBuffer: Buffer, maxWidth: number, maxHeight: number): Promise<string> {
  const resized = await sharp(inputBuffer)
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()
  return resized.toString('base64')
}

export async function generatePosterImage(data: {
  imageBase64: string[]
  colorimetry: any
  hairstyle: any
}): Promise<{ base64: string; filename: string }> {
  const { imageBase64, colorimetry, hairstyle } = data

  const gender: string = (hairstyle?.gender || colorimetry?.gender || 'female').toLowerCase()
  const isMale = gender.includes('male') || gender.includes('man') || gender.includes('hombre')

  const season = colorimetry?.season || colorimetry?.seasonSubtype || 'Soft Autumn'
  const dressColor = getDressColor(season)

  const genderInstructions = isMale
    ? `Add a new MALE person SEATED on the stairs next to Stanley Tucci in the center. He wears a matte black formal tuxedo with bow tie. His face must be extracted exactly from the reference photo provided.`
    : `Add a new FEMALE person STANDING on the left side of the stairs below Anne Hathaway. She wears an elegant long gala dress in ${dressColor}. His face must be extracted exactly from the reference photo provided.`

  const prompt = `Photorealistic movie poster editing. This is The Devil Wears Prada 2 poster featuring Meryl Streep in red dress at top, Anne Hathaway in white suit on left, Emily Blunt in black dress on right, and Stanley Tucci in tuxedo seated at bottom on white marble stairs. TASK: ${genderInstructions} RULES: Use exact face from reference. Keep all original cast untouched. Keep title text intact. No watermarks. Output: vertical portrait image optimized for mobile screen.`

  // Resize BASEIMAGE to max 1080px wide (mobile optimized)
  const baseImageBuffer = fs.readFileSync(BASEIMAGE_PATH)
  const baseImageResized = await resizeToBase64(baseImageBuffer, 1080, 1920)
  const baseImageDataUrl = `data:image/jpeg;base64,${baseImageResized}`

  // Resize user image to max 800px (enough for face reference)
  const userImageRaw = imageBase64[0]
  const userRawBuffer = Buffer.from(
    userImageRaw.replace(/^data:image\/\w+;base64,/, ''),
    'base64'
  )
  const userImageResized = await resizeToBase64(userRawBuffer, 800, 800)
  const userImageDataUrl = `data:image/jpeg;base64,${userImageResized}`

  console.log('[Poster] Images resized, submitting to fal.ai...')

  const requestBody = {
    prompt,
    image_url: baseImageDataUrl,
    image_urls: [userImageDataUrl],
    num_inference_steps: 20,        // reduced from 28 → faster
    guidance_scale: 3.5,
    num_images: 1,
    output_format: 'jpeg',          // jpeg is faster than png
    safety_tolerance: '2',
  }

  const submitResponse = await fetch(
    'https://queue.fal.run/fal-ai/flux-pro/kontext',
    {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!submitResponse.ok) {
    const errText = await submitResponse.text()
    throw new Error(`fal.ai submission failed: ${errText}`)
  }

  const { request_id } = await submitResponse.json() as any
  console.log(`[Poster] Submitted to fal.ai request_id=${request_id}`)

  // Poll with 3 min timeout (180s) — fal.ai queue can take up to 90s
  const resultUrl = await pollFalResult(request_id, 180000)
  console.log(`[Poster] fal.ai completed, downloading image...`)

  // Download and resize final image to mobile size (1080x1920 max)
  const imageResponse = await fetch(resultUrl)
  if (!imageResponse.ok) throw new Error('Failed to download generated poster')
  const rawBuffer = Buffer.from(await imageResponse.arrayBuffer())

  // Resize final output to mobile-friendly size
  const finalBuffer = await sharp(rawBuffer)
    .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const filename = `poster-${uuid()}.jpg`
  const base64 = finalBuffer.toString('base64')
  console.log(`[Poster] Generated: ${filename} (${Math.round(finalBuffer.length / 1024)}KB)`)
  return { base64, filename }
}

async function pollFalResult(requestId: string, maxWaitMs = 180000): Promise<string> {
  const start = Date.now()
  const statusUrl = `https://queue.fal.run/fal-ai/flux-pro/kontext/requests/${requestId}`

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 4000))

    try {
      const statusResponse = await fetch(`${statusUrl}/status`, {
        headers: { 'Authorization': `Key ${FAL_API_KEY}` },
      })

      if (!statusResponse.ok) continue

      const status = await statusResponse.json() as any
      console.log(`[Poster] fal.ai status: ${status.status} (${Math.round((Date.now() - start) / 1000)}s)`)

      if (status.status === 'COMPLETED') {
        const resultResponse = await fetch(statusUrl, {
          headers: { 'Authorization': `Key ${FAL_API_KEY}` },
        })
        const result = await resultResponse.json() as any
        const imageUrl = result?.images?.[0]?.url
        if (!imageUrl) throw new Error('fal.ai returned no image URL')
        return imageUrl
      }

      if (status.status === 'FAILED') {
        throw new Error(`fal.ai job failed: ${JSON.stringify(status)}`)
      }
    } catch (e: any) {
      if (e.message.includes('failed') || e.message.includes('no image')) throw e
      // network error — continue polling
    }
  }

  throw new Error(`fal.ai job timed out after ${Math.round(maxWaitMs / 1000)}s`)
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
