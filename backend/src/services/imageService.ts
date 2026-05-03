import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import sharp from 'sharp'

const REPORTS_DIR = path.join(__dirname, '../../reports')
const PROJECT_ROOT = path.resolve(__dirname, '../../')
const BASEIMAGE_PATH = path.join(PROJECT_ROOT, 'src/assets/BASEIMAGE.png')
const FAL_API_KEY = process.env.FAL_API_KEY

// ─── FIDELIDAD FACIAL ────────────────────────────────────────────────────────
// Para fal.ai flux-pro/kontext, la calidad de la cara del usuario es crítica.
//   · BASEIMAGE: 1080x1920 quality 85
//   · USER FACE: NO downscale si ya es menor a 1024px, quality 92 JPEG
//               fit: 'inside' para NO distorsionar proporciones del rostro
//   · OUTPUT FINAL: 390x844 (mobile full-screen) quality 88 → ~60-100KB

async function prepareBaseImage(inputBuffer: Buffer): Promise<string> {
  const resized = await sharp(inputBuffer)
    .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return resized.toString('base64')
}

async function prepareUserFace(inputBuffer: Buffer): Promise<string> {
  const meta = await sharp(inputBuffer).metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  const maxDim = Math.max(w, h)

  // Solo reducir si supera 1024px — nunca agrandar ni recortar
  const resized = await sharp(inputBuffer)
    .resize(
      maxDim > 1024 ? 1024 : undefined,
      maxDim > 1024 ? 1024 : undefined,
      { fit: 'inside', withoutEnlargement: true }
    )
    .jpeg({ quality: 92 })
    .toBuffer()

  const finalMeta = await sharp(resized).metadata()
  console.log(`[Poster] User face: ${w}x${h} → ${finalMeta.width}x${finalMeta.height} @ q92 (${Math.round(resized.length/1024)}KB)`)
  return resized.toString('base64')
}

// ─── DETECCIÓN DE GÉNERO ──────────────────────────────────────────────────────
// FIX: "female".includes("male") === true → siempre chequear female primero
function detectIsMale(gender: string): boolean {
  const g = gender.toLowerCase().trim()
  if (g.includes('female') || g.includes('mujer') || g.includes('femenino') || g === 'f') return false
  if (g.includes('male') || g.includes('man') || g.includes('hombre') || g.includes('masculino') || g === 'm') return true
  return false
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function generatePosterImage(data: {
  imageBase64: string[]
  colorimetry: any
  hairstyle: any
}): Promise<string> {
  const { imageBase64, colorimetry, hairstyle } = data

  const gender: string = (hairstyle?.gender || colorimetry?.gender || 'female').toLowerCase()
  const isMale = detectIsMale(gender)

  const season = colorimetry?.season || colorimetry?.seasonSubtype || 'Soft Autumn'
  const dressColor = getDressColor(season)

  // FIX prompt: pronombre correcto por género + énfasis en fidelidad facial
  const genderInstructions = isMale
    ? `Add a new MALE person SEATED on the stairs next to Stanley Tucci in the center. He wears a matte black formal tuxedo with bow tie. Extract his face exactly from the reference photo — preserve facial features, skin tone, and expression with maximum fidelity.`
    : `Add a new FEMALE person STANDING on the left side of the stairs below Anne Hathaway. She wears an elegant long gala dress in ${dressColor}. Extract her face exactly from the reference photo — preserve facial features, skin tone, and expression with maximum fidelity.`

  const prompt = `Photorealistic movie poster editing. This is The Devil Wears Prada 2 poster featuring Meryl Streep in red dress at top, Anne Hathaway in white suit on left, Emily Blunt in black dress on right, and Stanley Tucci in tuxedo seated at bottom on white marble stairs. TASK: ${genderInstructions} CRITICAL RULES: The new person's face must be an exact photorealistic copy from the reference image — same features, same skin, same expression. Keep all original cast completely untouched. Keep all title text and poster typography intact. No watermarks. Output: vertical portrait poster optimized for mobile screen.`

  const baseImageBuffer = fs.readFileSync(BASEIMAGE_PATH)
  const baseImageB64 = await prepareBaseImage(baseImageBuffer)
  const baseImageDataUrl = `data:image/jpeg;base64,${baseImageB64}`

  const userImageRaw = imageBase64[0]
  const userRawBuffer = Buffer.from(
    userImageRaw.replace(/^data:image\/\w+;base64,/, ''),
    'base64'
  )
  const userFaceB64 = await prepareUserFace(userRawBuffer)
  const userImageDataUrl = `data:image/jpeg;base64,${userFaceB64}`

  console.log('[Poster] Submitting to fal.ai flux-pro/kontext...')

  const requestBody = {
    prompt,
    image_url: baseImageDataUrl,
    image_urls: [userImageDataUrl],
    num_inference_steps: 28,   // 20 era insuficiente para fidelidad facial en kontext
    guidance_scale: 3.5,
    num_images: 1,
    output_format: 'jpeg',
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
  console.log(`[Poster] Submitted request_id=${request_id}`)

  const resultUrl = await pollFalResult(request_id, 180000)
  console.log(`[Poster] fal.ai completed, downloading...`)

  const imageResponse = await fetch(resultUrl)
  if (!imageResponse.ok) throw new Error('Failed to download generated poster')
  const rawBuffer = Buffer.from(await imageResponse.arrayBuffer())

  // OUTPUT MOBILE-FIRST: 390x844px full-screen iPhone SE
  // ~60-100KB vs ~800KB anterior con 1080x1920
  const finalBuffer = await sharp(rawBuffer)
    .resize(390, 844, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()

  const filename = `poster-${uuid()}.jpg`
  const outputPath = path.join(REPORTS_DIR, filename)
  fs.writeFileSync(outputPath, finalBuffer)
  console.log(`[Poster] Saved: ${filename} (${Math.round(finalBuffer.length / 1024)}KB)`)
  return `/reports/${filename}`
}

// ─── POLLING FAL.AI ───────────────────────────────────────────────────────────

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
    }
  }

  throw new Error(`fal.ai job timed out after ${Math.round(maxWaitMs / 1000)}s`)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
