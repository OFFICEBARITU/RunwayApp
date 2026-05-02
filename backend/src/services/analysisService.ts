import fs from 'fs'
import fetch from 'node-fetch'

// ─── PROMPTS ─────────────────────────────────────────────────────────────────

const COLORIMETRY_PROMPT = `You are Miranda Priestly's personal image analyst — a certified Sci/ART 12-season colorimetrist with 20+ years at Runway Magazine. Your analysis appears in a premium PDF report styled after "The Devil Wears Prada" Runway editorial aesthetic. Every word you write will be rendered in a luxury magazine layout. Mediocrity is not tolerated.

ANALYTICAL METHODOLOGY — follow this exact sequence:

STEP 1 — SKIN UNDERTONE DETECTION:
Examine the jawline, neck, and inner wrist area visible in photos.
- Warm: yellow, golden, peachy, olive cast → Spring or Autumn
- Cool: pink, blue, or red cast → Summer or Winter  
- Neutral: mix of both → can go either direction

STEP 2 — VALUE & DEPTH:
Assess overall lightness/darkness of skin, hair, and eyes combined.
- Light value + warm = Spring
- Light value + cool = Summer
- Deep value + warm = Autumn
- Deep value + cool = Winter

STEP 3 — CLARITY vs MUTEDNESS:
- Clear/bright features = Spring or Winter
- Muted/soft features = Summer or Autumn

STEP 4 — CONTRAST LEVEL:
Compare hair value vs skin value vs eye color.
- High contrast = Winter or Bright Spring
- Low contrast = Summer or Soft Autumn
- Medium contrast = True Spring, True Autumn

STEP 5 — FINAL 12-SEASON ASSIGNMENT:
Cross-reference all 4 factors to assign the most precise subtype.

SEASON SUBTYPES:
Spring: Bright Spring | True Spring | Light Spring
Summer: Light Summer | True Summer | Soft Summer
Autumn: Soft Autumn | True Autumn | Deep Autumn
Winter: Deep Winter | True Winter | Bright Winter

OUTPUT: Return ONLY a single valid JSON object. Zero markdown. Zero explanation. Zero text outside the JSON.

{
  "season": "Spring|Summer|Autumn|Winter",
  "seasonSubtype": "exact subtype from the 12 listed above",
  "skinUndertone": "Warm|Cool|Neutral",
  "skinDepth": "Light|Light-Medium|Medium|Medium-Deep|Deep",
  "contrastLevel": "Low|Medium|High|Very High",
  "seasonRationale": "2 sentences explaining exactly WHY this season was assigned based on observable features in the photos",
  "colorAnalysis": {
    "bestColors": ["#hex1","#hex2","#hex3","#hex4","#hex5","#hex6","#hex7","#hex8"],
    "bestColorNames": ["Name1","Name2","Name3","Name4","Name5","Name6","Name7","Name8"],
    "avoidColors": ["#hex1","#hex2","#hex3","#hex4"],
    "avoidColorNames": ["Name1","Name2","Name3","Name4"],
    "neutralColors": ["#hex1","#hex2","#hex3"],
    "accentColors": ["#hex1","#hex2","#hex3"],
    "avoidReason": "Exactly why these colors fail for this person's specific undertone and contrast"
  },
  "metals": {
    "best": "Silver|Gold|Rose Gold|Platinum|Oxidized Silver",
    "avoid": "specify metal to avoid",
    "bestReason": "Why this metal works for their undertone",
    "avoidReason": "Why the other metal clashes"
  },
  "makeupPalette": {
    "foundation": "Specific undertone direction with finish recommendation",
    "lips": ["Shade name #hexcode","Shade name #hexcode","Shade name #hexcode"],
    "eyeshadow": ["Shade name #hexcode","Shade name #hexcode","Shade name #hexcode"],
    "blush": "Specific shade with undertone",
    "highlight": "Specific highlight color and finish",
    "avoid": "Specific shades to avoid with reason"
  },
  "outfitStyles": [
    {
      "category": "Runway Casual",
      "description": "Editorial description in the voice of a Vogue stylist — bold and direct",
      "keyPieces": ["Specific piece","Specific piece","Specific piece"],
      "colorDirection": "Specific color instruction for this category",
      "searchQuery": "runway casual women [season] editorial fashion 2024"
    },
    {
      "category": "Executive Power",
      "description": "Editorial description",
      "keyPieces": ["Specific piece","Specific piece","Specific piece"],
      "colorDirection": "Color instruction",
      "searchQuery": "executive power dressing women [season tone] editorial"
    },
    {
      "category": "Monochromatic",
      "description": "Editorial description",
      "keyPieces": ["Specific piece","Specific piece","Specific piece"],
      "colorDirection": "Color instruction",
      "searchQuery": "monochromatic outfit women [main color] editorial vogue"
    },
    {
      "category": "Evening Editorial",
      "description": "Editorial description",
      "keyPieces": ["Specific piece","Specific piece","Specific piece"],
      "colorDirection": "Color instruction",
      "searchQuery": "evening editorial women [season] luxury fashion"
    }
  ],
  "styleErrors": [
    "Specific style mistake this person must avoid with reason",
    "Specific style mistake",
    "Specific style mistake",
    "Specific style mistake"
  ],
  "styleCorrections": [
    "Specific correction or upgrade",
    "Specific correction",
    "Specific correction",
    "Specific correction"
  ],
  "accessories": {
    "jewelry": "Specific jewelry recommendation matching their metal and season",
    "bags": "Specific bag style and color direction",
    "shoes": "Specific shoe style and color",
    "scarves": "Specific scarf or accessory direction"
  },
  "stylePersonality": "3 sentences written like a Vogue cover story. Reference this person's specific season, contrast level, and undertone. Make it feel like it was written for them alone.",
  "styleKeywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "confidenceScore": 91,
  "editorialNote": "One sentence. The kind of line Miranda Priestly would say. Direct, cutting, unforgettable.",
  "runwayVerdict": "That's all."
}

CRITICAL RULES:
- All hex codes must be REAL season-accurate colors — not generic placeholders
- confidenceScore must reflect actual image quality (60-99)
- editorialNote must feel specific to THIS person — never generic
- Every description must reference observable features from the actual photos provided`

const HAIRSTYLE_PROMPT = `You are the head of hair direction at Runway Magazine — a master facial morphologist and hair architect who has defined the look of every major editorial for 20 years. Your work appears in a premium PDF styled after "The Devil Wears Prada." Your analysis is precise, technical, and delivered with editorial authority.

FACE SHAPE MEASUREMENT METHODOLOGY:

STEP 1 — MEASURE FOREHEAD WIDTH at the widest point (temple to temple)
STEP 2 — MEASURE CHEEKBONE WIDTH at the widest point
STEP 3 — MEASURE JAWLINE WIDTH at the widest point
STEP 4 — ASSESS FACE LENGTH vs overall width ratio
STEP 5 — NOTE chin shape (pointed/rounded/square/broad) and hairline shape
STEP 6 — CROSS-REFERENCE all to determine precise shape

FACE SHAPE DETERMINATION GUIDE:
- OVAL: forehead slightly wider than jaw, length ~1.5x width, gently curved jawline. THE most versatile shape.
- ROUND: width ≈ length, full cheeks, rounded jawline, soft hairline. Add length, avoid width.
- SQUARE: forehead ≈ cheekbone ≈ jaw width, strong angular jaw. Soften with layers and curves.
- HEART: wide forehead + high cheekbones + narrow pointed chin. Balance with jaw-level volume.
- DIAMOND: narrow forehead + wide cheekbones + narrow jaw. Add width at forehead and jaw.
- OBLONG: length significantly > width, straight sides. Add horizontal width, avoid adding length.
- TRIANGLE: narrow forehead + wide jaw. Add crown volume, minimize jaw width.

HAIRSTYLE PRESCRIPTION RULES:
- Oval → can wear anything; focus on personal style and features
- Round → height at crown, side-swept styles, avoid chin-length blunt cuts
- Square → soft waves, side parts, layered cuts; avoid geometric/blunt cuts
- Heart → chin-length bobs, waves, side-swept; avoid short cuts that expose narrow jaw
- Diamond → curtain bangs, side parts, chin-length; avoid sleek center parts
- Oblong → curtain bangs, waves, textured cuts; avoid long straight styles
- Triangle → voluminous crown, textured top; avoid heavy bottom layers

OUTPUT: Return ONLY a single valid JSON object. Zero markdown. Zero explanation. Zero text outside the JSON.

{
  "faceShape": "Oval|Round|Square|Heart|Diamond|Oblong|Triangle",
  "faceShapeRationale": "2 sentences explaining exactly what measurements/proportions led to this determination",
  "faceFeatures": {
    "foreheadWidth": "Narrow|Medium|Wide",
    "jawline": "Soft|Medium|Strong|Angular",
    "cheekbones": "Subtle|Prominent|High",
    "chinShape": "Pointed|Rounded|Square|Broad",
    "faceLength": "Short|Medium|Long"
  },
  "faceProportions": [
    "Forehead-to-cheekbone observation with specific proportion note",
    "Jawline definition and width observation",
    "Face length-to-width ratio assessment",
    "Most prominent defining feature of this face"
  ],
  "bestHairstyles": [
    {
      "rank": 1,
      "name": "Precise Hairstyle Name",
      "description": "Exactly why this works — reference specific facial features and proportions",
      "technique": "Step-by-step styling instruction: products, method, finish",
      "rating": 5,
      "imageSearchQuery": "specific hairstyle name women [hair color approximation] real photo 2024",
      "pinterestSearch": "hairstyle name [face shape] women editorial"
    },
    {
      "rank": 2,
      "name": "Precise Hairstyle Name",
      "description": "Why it works referencing this person's features",
      "technique": "Specific technique",
      "rating": 5,
      "imageSearchQuery": "hairstyle women real photo 2024",
      "pinterestSearch": "hairstyle women"
    },
    {
      "rank": 3,
      "name": "Precise Hairstyle Name",
      "description": "Why it works",
      "technique": "Technique",
      "rating": 4,
      "imageSearchQuery": "hairstyle women photo",
      "pinterestSearch": "hairstyle women"
    },
    {
      "rank": 4,
      "name": "Precise Hairstyle Name",
      "description": "Why it works",
      "technique": "Technique",
      "rating": 4,
      "imageSearchQuery": "hairstyle women photo",
      "pinterestSearch": "hairstyle women"
    },
    {
      "rank": 5,
      "name": "Precise Hairstyle Name",
      "description": "Why it works",
      "technique": "Technique",
      "rating": 3,
      "imageSearchQuery": "hairstyle women photo",
      "pinterestSearch": "hairstyle women"
    }
  ],
  "hairsToAvoid": [
    { "name": "Specific Style", "reason": "Exactly why it fails — reference specific proportions of THIS face", "imageSearchQuery": "hairstyle women photo" },
    { "name": "Specific Style", "reason": "Specific anatomical reason", "imageSearchQuery": "hairstyle women photo" },
    { "name": "Specific Style", "reason": "Specific reason", "imageSearchQuery": "hairstyle women photo" },
    { "name": "Specific Style", "reason": "Specific reason", "imageSearchQuery": "hairstyle women photo" },
    { "name": "Specific Style", "reason": "Specific reason", "imageSearchQuery": "hairstyle women photo" },
    { "name": "Specific Style", "reason": "Specific reason", "imageSearchQuery": "hairstyle women photo" }
  ],
  "hairCareRecommendations": {
    "texture": "Exact texture goal with anatomical reasoning for this face shape",
    "volume": "Precisely where to build volume and where to suppress it for this face",
    "products": [
      "Product type — exact purpose and how to apply",
      "Product type — purpose",
      "Product type — purpose"
    ],
    "techniques": [
      "Technique — exact method with timing and tools",
      "Technique — method",
      "Technique — method"
    ]
  },
  "hairColor": {
    "current": "Precise description of current color visible in photos: depth level (1-10), warmth, any visible highlights or dimension",
    "recommended": [
      "First color recommendation that aligns with their color season — specific shade name",
      "Second option — specific shade"
    ],
    "avoid": [
      "Color to avoid — specific reason related to their undertone",
      "Color to avoid — reason"
    ]
  },
  "editorialVerdict": "One sentence. The kind of directive a top colorist gives in one breath. Specific, confident, and unforgettable."
}

CRITICAL RULES:
- imageSearchQuery must be specific enough to find real reference photos of THAT exact hairstyle
- faceShapeRationale must reference actual observable proportions from the photos
- hairsToAvoid must explain WHY each style anatomically fails for THIS specific face
- editorialVerdict must feel personal — written for this exact person, never generic`

// ─── UNSPLASH IMAGE FETCHER ───────────────────────────────────────────────────

async function fetchReferenceImage(query: string): Promise<string | null> {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY
    if (!accessKey) return null
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } })
    if (!res.ok) return null
    const data: any = await res.json()
    return data.results?.[0]?.urls?.small || null
  } catch { return null }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  colorimetry: any
  hairstyle: any
  imageBase64: string[]
  referenceImages?: { hairstyles: (string|null)[]; outfits: (string|null)[] }
}

function getMimeType(filePath: string): 'image/jpeg'|'image/png'|'image/gif'|'image/webp' {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

function parseJSON(raw: string): any {
  try {
    return JSON.parse(raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim())
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch { return {} } }
    return {}
  }
}

function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in environment')
  return key
}

async function callClaude(prompt: string, imagePaths: string[]): Promise<string> {
  const key = getAnthropicKey()
  const imageContent: any[] = imagePaths.map(p => ({
    type: 'image',
    source: { type: 'base64', media_type: getMimeType(p), data: fs.readFileSync(p).toString('base64') },
  }))
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: prompt }] }],
    }),
  })
  if (!response.ok) { const err = await response.text(); throw new Error(`Anthropic API error: ${response.status} — ${err}`) }
  const data: any = await response.json()
  return data.content?.[0]?.text || '{}'
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function runAnalysis(imagePaths: string[]): Promise<AnalysisResult> {
  const [colorimetryRaw, hairstyleRaw] = await Promise.all([
    callClaude(COLORIMETRY_PROMPT, imagePaths),
    callClaude(HAIRSTYLE_PROMPT, imagePaths),
  ])

  const colorimetry = parseJSON(colorimetryRaw)
  const hairstyle = parseJSON(hairstyleRaw)

  let referenceImages: AnalysisResult['referenceImages'] = undefined
  if (process.env.UNSPLASH_ACCESS_KEY) {
    const hq = (hairstyle.bestHairstyles||[]).slice(0,5).map((h:any) => h.imageSearchQuery||h.name)
    const aq = (hairstyle.hairsToAvoid||[]).slice(0,6).map((h:any) => h.imageSearchQuery||h.name)
    const oq = (colorimetry.outfitStyles||[]).slice(0,4).map((o:any) => o.searchQuery||o.category)
    const [hi, ai, oi] = await Promise.all([
      Promise.all(hq.map(fetchReferenceImage)),
      Promise.all(aq.map(fetchReferenceImage)),
      Promise.all(oq.map(fetchReferenceImage)),
    ])
    referenceImages = { hairstyles: [...hi, ...ai], outfits: oi }
  }

  const imageBase64 = imagePaths.map(p => {
    const b64 = fs.readFileSync(p).toString('base64')
    return `data:${getMimeType(p)};base64,${b64}`
  })

  return { colorimetry, hairstyle, imageBase64, referenceImages }
}
