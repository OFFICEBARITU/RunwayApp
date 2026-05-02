import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'

const REPORTS_DIR = path.join(__dirname, '../../reports')
const PROJECT_ROOT = path.resolve(__dirname, '../../')
const BASEIMAGE_PATH = path.join(PROJECT_ROOT, 'src/assets/BASEIMAGE.png')
const FAL_API_KEY = process.env.FAL_API_KEY

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
    ? `Add a new MALE person SEATED on the stairs next to Stanley Tucci in the center. He wears a matte black formal tuxedo with bow tie. His face must be extracted exactly from the reference photo provided.`
    : `Add a new FEMALE person STANDING on the left side of the stairs below Anne Hathaway. She wears an elegant long gala dress in ${dressColor}. Her face must be extracted exactly from the reference photo provided.`

  const prompt = `Photorealistic movie poster editing. This is The Devil Wears Prada 2 poster featuring Meryl Streep in red dress at top, Anne Hathaway in white suit on left, Emily Blunt in black dress on right, and Stanley Tucci in tuxedo seated at bottom on white marble stairs.

TASK: ${genderInstructions}

STRICT RULES:
- Face identity: use the exact face from the reference image. Do not generate a new face.
- Proportional scale: new person must match the scale and perspective of existing cast members.
- Do NOT move, modify or alter Meryl Streep, Anne Hathaway, Emily Blunt or Stanley Tucci in any way.
- Keep the title text "THE DEVIL WEARS PRADA 2" exactly as it appears.
- Studio lighting: match the white/overhead studio light from the original poster.
- No extra text, watermarks or overlays.
- Output: vertical high-resolution photorealistic image.`

  const baseImageBuffer = fs.readFileSync(BASEIMAGE_PATH)
  const baseImageBase64 = baseImageBuffer.toString('base64')
  const baseImageDataUrl = `data:image/png;base64,${baseImageBase64}`

  const userImageRaw = imageBase64[0]
  const userImageDataUrl = userImageRaw.startsWith('data:')
    ? userImageRaw
    : `data:image/jpeg;base64,${userImageRaw}`

  const requestBody = {
    prompt,
    image_url: baseImageDataUrl,
    image_urls: [userImageDataUrl],
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: 'png',
    safety_tolerance: '2',
  }

  const submitResponse = await fetch(
    'https://queue.fal.run/fal-ai/flux-kontext-pro',
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
  const resultUrl = await pollFalResult(request_id)

  const imageResponse = await fetch(resultUrl)
  if (!imageResponse.ok) throw new Error('Failed to download generated poster')
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

  const filename = `poster-${uuid()}.png`
  const outputPath = path.join(REPORTS_DIR, filename)
  fs.writeFileSync(outputPath, imageBuffer)

  return `/reports/${filename}`
}

async function pollFalResult(requestId: string, maxWaitMs = 120000): Promise<string> {
  const start = Date.now()
  const statusUrl = `https://queue.fal.run/fal-ai/flux-kontext-pro/requests/${requestId}`

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000))

    const statusResponse = await fetch(`${statusUrl}/status`, {
      headers: { 'Authorization': `Key ${FAL_API_KEY}` },
    })

    if (!statusResponse.ok) continue

    const status = await statusResponse.json() as any

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
  }

  throw new Error('fal.ai job timed out after 2 minutes')
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
