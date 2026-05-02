import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'

const REPORTS_DIR = path.join(__dirname, '../../reports')
// src/assets is not compiled by tsc — resolve from project root
const PROJECT_ROOT = path.resolve(__dirname, '../../')
const BASEIMAGE_PATH = path.join(PROJECT_ROOT, 'src/assets/BASEIMAGE.png')
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function generatePosterImage(data: {
  imageBase64: string[]
  colorimetry: any
  hairstyle: any
}): Promise<string> {
  const { imageBase64, colorimetry, hairstyle } = data

  // Detect gender from analysis
  const gender: string = (hairstyle?.gender || colorimetry?.gender || 'female').toLowerCase()
  const isMale = gender.includes('male') || gender.includes('man') || gender.includes('hombre')

  // Build gender-specific prompt
  const genderInstructions = isMale
    ? `The subject is MALE. Place him SEATED on the same step as Stanley Tucci, positioned in the center of the staircase. Dress him in a matte black formal tuxedo.`
    : `The subject is FEMALE. Place her STANDING, positioned exactly below Anne Hathaway on the left side. Dress her in a long gala dress. Choose the dress color based on her skin and hair colorimetry for maximum harmony — her season is ${colorimetry?.season || 'Soft Autumn'}.`

  const prompt = `Photorealistic poster editing task. You are given two images: the first is a movie poster base (The Devil Wears Prada 2 with Meryl Streep, Anne Hathaway, Emily Blunt, and Stanley Tucci on a white marble staircase), and the second is a photo of a real person to integrate into the poster.

STRICT RULES:
1. IDENTITY FIDELITY: Extract the face from the second image directly. Transfer the exact facial structure, eyes, nose, and mouth. Do NOT generate a new face. Apply face restoration and edge refinement so the face blends naturally with the studio lighting of the poster.
2. REALISTIC SCALE: The added person must be proportional in size and height to the existing actors and the staircase perspective. Not too big, not too small.
3. POSITIONING: ${genderInstructions}
4. ORIGINALS INTACT: Do NOT modify, move or alter Meryl Streep, Anne Hathaway, Emily Blunt, or Stanley Tucci in any way.
5. KEEP TITLE: The text "THE DEVIL WEARS PRADA 2" must remain intact and unmodified.
6. NO EXTRA TEXT: No additional text, credits, watermarks, or overlays.
7. OUTPUT: Vertical high-resolution image, PNG format, photorealistic quality.`

  // Load base image
  const baseImageBuffer = fs.readFileSync(BASEIMAGE_PATH)
  const baseImageBase64 = baseImageBuffer.toString('base64')

  // Use first user image (face photo — most frontal)
  const userImageBase64 = imageBase64[0].replace(/^data:image\/\w+;base64,/, '')

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: 'image/png',
              data: baseImageBase64,
            },
          },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: userImageBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['image', 'text'],
    },
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini image generation failed: ${errText}`)
  }

  const result = await response.json() as any

  // Extract image from response
  const parts = result?.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: any) => p.inline_data?.mime_type?.startsWith('image/'))

  if (!imagePart) {
    throw new Error('Gemini did not return an image in the response')
  }

  // Save PNG to reports dir
  const filename = `poster-${uuid()}.png`
  const outputPath = path.join(REPORTS_DIR, filename)
  const imageBuffer = Buffer.from(imagePart.inline_data.data, 'base64')
  fs.writeFileSync(outputPath, imageBuffer)

  return `/reports/${filename}`
}
