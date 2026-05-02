import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'

const REPORTS_DIR = path.join(__dirname, '../../reports')
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r},${g},${b})`
}

function generateReportHTML(data: {
  colorimetry: any
  hairstyle: any
  imageBase64: string[]
  lang: string
  referenceImages?: { hairstyles: (string|null)[]; outfits: (string|null)[] }
}): string {
  const { colorimetry: c, hairstyle: h, imageBase64: imgs, referenceImages: refs } = data
  const refHairstyles = refs?.hairstyles || []
  const refOutfits = refs?.outfits || []

  const bestColors = (c.colorAnalysis?.bestColors || []).slice(0, 8)
  const avoidColors = (c.colorAnalysis?.avoidColors || []).slice(0, 4)
  const bestHairstyles = (h.bestHairstyles || []).slice(0, 5)
  const hairstylesToAvoid = (h.hairsToAvoid || []).slice(0, 6)

  const outfitCategories = (c.outfitStyles || []).slice(0, 4)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Montserrat:wght@100;200;300;400&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #F2EDE4;
  color: #111;
  font-family: 'Montserrat', sans-serif;
  font-weight: 200;
  font-size: 10px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── PAGE 1: COLORIMETRY ─────────────────────────────────────── */
.page {
  width: 390px;
  min-height: 844px;
  background: #F2EDE4;
  position: relative;
  overflow: hidden;
  page-break-after: always;
}

.page-dark {
  background: #0C0C0C;
  color: #F2EDE4;
}

.header {
  background: #0C0C0C;
  color: #F2EDE4;
  padding: 20px 20px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.header-img {
  width: 72px;
  height: 88px;
  object-fit: cover;
  object-position: center top;
  flex-shrink: 0;
  filter: grayscale(20%);
}

.header-text { flex: 1; }

.brand {
  font-family: 'Cormorant Garamond', serif;
  font-size: 10px;
  letter-spacing: 0.55em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.45);
  margin-bottom: 4px;
}

.header h1 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-style: italic;
  font-weight: 300;
  line-height: 1.1;
  color: #F2EDE4;
  margin-bottom: 6px;
}

.section-label {
  font-size: 7px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.4);
}

.badge-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.badge {
  border: 1px solid rgba(242,237,228,0.25);
  padding: 3px 8px;
  font-size: 7px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.7);
}

.rouge-line { width: 32px; height: 1px; background: #C0001A; }

/* Seasons block */
.seasons-block {
  padding: 14px 16px 10px;
  background: #111;
}

.seasons-title {
  font-size: 7px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.4);
  margin-bottom: 10px;
}

.seasons-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.season-card {
  border: 1px solid rgba(242,237,228,0.1);
  padding: 8px 6px;
  text-align: center;
  position: relative;
}

.season-card.active {
  border-color: #C0001A;
  background: rgba(192,0,26,0.08);
}

.season-img {
  width: 100%;
  height: 52px;
  object-fit: cover;
  object-position: center top;
  margin-bottom: 4px;
  filter: grayscale(30%);
}

.season-card.active .season-img { filter: grayscale(0%); }

.season-name {
  font-size: 6.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.5);
  display: block;
  margin-bottom: 2px;
}

.season-card.active .season-name { color: #F2EDE4; }

.season-sub {
  font-size: 5.5px;
  color: rgba(242,237,228,0.3);
  letter-spacing: 0.1em;
}

.best-season-label {
  font-size: 7px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #C0001A;
  margin-top: 8px;
  text-align: center;
}

/* Colors block */
.colors-section {
  padding: 12px 16px;
  background: #111;
}

.colors-section + .colors-section { border-top: 1px solid rgba(242,237,228,0.06); }

.col-label {
  font-size: 6.5px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.favorable-label { color: #4CAF50; }
.avoid-label { color: #C0001A; }

.color-faces-row {
  display: flex;
  gap: 4px;
  overflow-x: auto;
}

.color-face-item {
  flex-shrink: 0;
  width: 44px;
  text-align: center;
}

.color-face-img {
  width: 44px;
  height: 54px;
  object-fit: cover;
  object-position: center top;
}

.color-overlay {
  width: 44px;
  height: 54px;
  position: relative;
  overflow: hidden;
}

.color-overlay .img-bg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.color-overlay .color-tint {
  position: absolute;
  inset: 0;
  opacity: 0.7;
  mix-blend-mode: multiply;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin: 3px auto 1px;
}

.color-name {
  font-size: 5px;
  color: rgba(242,237,228,0.4);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: center;
  line-height: 1.3;
}

/* Metals row */
.metals-row {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: #0a0a0a;
  border-top: 1px solid rgba(242,237,228,0.06);
}

.metal-item {
  flex: 1;
  text-align: center;
}

.metal-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin: 0 auto 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
}

.silver-circle { background: radial-gradient(circle at 35% 35%, #e8e8e8, #a0a0a0, #606060); }
.gold-circle { background: radial-gradient(circle at 35% 35%, #f5d782, #c9a227, #8b6914); }

.metal-label { font-size: 6.5px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(242,237,228,0.5); }
.metal-verdict { font-size: 6px; color: rgba(242,237,228,0.3); margin-top: 2px; }

/* Undertone / palette section */
.undertone-palette {
  padding: 12px 16px;
  background: #0e0e0e;
  border-top: 1px solid rgba(242,237,228,0.06);
}

.ut-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ut-label {
  font-size: 6.5px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.4);
  margin-bottom: 4px;
}

.ut-value {
  font-family: 'Cormorant Garamond', serif;
  font-size: 16px;
  font-style: italic;
  color: #F2EDE4;
}

.palette-row { display: flex; gap: 3px; margin-top: 8px; }
.palette-swatch { height: 20px; flex: 1; border-radius: 0; }

/* ── PAGE 2: HAIRSTYLES ───────────────────────────────────────── */
.hair-header {
  background: #1a1a1a;
  padding: 16px;
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
  align-items: start;
}

.face-shape-diagram {
  width: 80px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(242,237,228,0.1);
  padding: 8px;
  text-align: center;
}

.face-oval {
  width: 36px;
  height: 48px;
  border: 1.5px solid rgba(242,237,228,0.5);
  border-radius: 50%;
  margin: 0 auto 4px;
}

.face-checks { margin-top: 4px; }

.face-check {
  font-size: 6px;
  color: rgba(242,237,228,0.5);
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 2px;
  line-height: 1.4;
}

.check-green { color: #4CAF50; font-size: 7px; }

.hair-avoid-section {
  padding: 10px 16px;
  background: #111;
}

.avoid-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 8px;
}

.avoid-card {
  position: relative;
  text-align: center;
}

.avoid-img {
  width: 100%;
  height: 62px;
  object-fit: cover;
  object-position: center top;
  filter: grayscale(60%);
  opacity: 0.7;
}

.avoid-x {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  background: #C0001A;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: white;
  font-weight: 700;
}

.avoid-name {
  font-size: 5.5px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(242,237,228,0.45);
  margin-top: 3px;
  line-height: 1.3;
}

.favorable-section {
  padding: 10px 16px;
  background: #0a0a0a;
  border-top: 1px solid rgba(242,237,228,0.06);
}

.favorable-label-block {
  background: rgba(76,175,80,0.12);
  border: 1px solid rgba(76,175,80,0.3);
  color: #4CAF50;
  font-size: 7px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  text-align: center;
  padding: 4px 0;
  margin-bottom: 8px;
}

.favorable-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.favorable-card { text-align: center; }

.favorable-img {
  width: 100%;
  height: 64px;
  object-fit: cover;
  object-position: center top;
}

.favorable-name {
  font-size: 5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(242,237,228,0.5);
  margin-top: 3px;
  line-height: 1.4;
}

.check-badge {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #4CAF50;
  border-radius: 50%;
  color: white;
  font-size: 6px;
  line-height: 10px;
  text-align: center;
  margin: 2px auto 1px;
}

.tips-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 8px 16px;
  background: #111;
  border-top: 1px solid rgba(242,237,228,0.06);
}

.tip-item {
  text-align: center;
  padding: 6px 4px;
  border: 1px solid rgba(242,237,228,0.08);
}

.tip-icon { font-size: 12px; margin-bottom: 3px; }
.tip-text { font-size: 6px; color: rgba(242,237,228,0.45); line-height: 1.5; letter-spacing: 0.08em; }

.ranking-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border-top: 1px solid rgba(242,237,228,0.06);
}

.ranking-list {
  padding: 10px 14px;
  background: #0c0c0c;
  border-right: 1px solid rgba(242,237,228,0.06);
}

.ranking-title {
  font-size: 6.5px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.3);
  margin-bottom: 8px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.rank-num {
  width: 14px;
  height: 14px;
  background: rgba(192,0,26,0.15);
  border: 1px solid rgba(192,0,26,0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6.5px;
  color: #C0001A;
  flex-shrink: 0;
}

.rank-num.gold { background: rgba(197,167,83,0.15); border-color: rgba(197,167,83,0.5); color: #c5a753; }

.rank-thumb {
  width: 22px;
  height: 22px;
  object-fit: cover;
  object-position: center top;
  flex-shrink: 0;
}

.rank-label { font-size: 6.5px; color: rgba(242,237,228,0.6); letter-spacing: 0.08em; text-transform: uppercase; }

.stars { color: #c5a753; font-size: 6px; }

.glowup-section {
  padding: 10px 12px;
  background: #0e0e0e;
}

.glowup-title {
  font-size: 6.5px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.3);
  text-align: center;
  margin-bottom: 8px;
}

.glowup-compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 4px;
  align-items: center;
}

.glowup-img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  object-position: center top;
}

.glowup-label {
  font-size: 6px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-align: center;
  margin-top: 3px;
  color: rgba(242,237,228,0.4);
}

.glowup-label.after { color: #4CAF50; }

.vs-badge {
  background: #C0001A;
  color: white;
  font-size: 7px;
  font-weight: 700;
  padding: 3px 5px;
  letter-spacing: 0.1em;
}

/* ── PAGE 3: STYLE ────────────────────────────────────────────── */
.style-header {
  background: #0C0C0C;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.style-analysis-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 0 16px;
  margin-top: 10px;
}

.style-badge {
  border: 1px solid rgba(242,237,228,0.1);
  padding: 5px 8px;
  text-align: center;
}

.style-badge-label {
  font-size: 6px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.3);
  margin-bottom: 2px;
}

.style-badge-value {
  font-family: 'Cormorant Garamond', serif;
  font-size: 13px;
  font-style: italic;
  color: #F2EDE4;
}

.palette-recom {
  padding: 10px 16px;
  background: #0a0a0a;
  border-top: 1px solid rgba(242,237,228,0.06);
}

.palette-label {
  font-size: 7px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.35);
  margin-bottom: 8px;
}

.palette-big-row {
  display: flex;
  gap: 4px;
}

.palette-big-swatch {
  flex: 1;
  height: 32px;
  position: relative;
  display: flex;
  align-items: flex-end;
  padding-bottom: 3px;
  justify-content: center;
}

.swatch-hex {
  font-size: 5px;
  color: rgba(242,237,228,0.6);
  letter-spacing: 0.05em;
}

.outfit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.outfit-cat {
  padding: 10px 12px;
  border-right: 1px solid rgba(242,237,228,0.06);
  border-bottom: 1px solid rgba(242,237,228,0.06);
}

.outfit-cat:nth-child(2n) { border-right: none; }
.outfit-cat:nth-child(n+3) { border-bottom: none; }

.outfit-cat-name {
  font-size: 7px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #F2EDE4;
  margin-bottom: 5px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(192,0,26,0.3);
}

.outfit-pieces { list-style: none; }

.outfit-piece {
  font-size: 8px;
  color: rgba(242,237,228,0.5);
  padding: 2px 0;
  padding-left: 10px;
  position: relative;
  line-height: 1.5;
}

.outfit-piece::before {
  content: '—';
  position: absolute;
  left: 0;
  color: rgba(192,0,26,0.5);
  font-size: 7px;
}

.dos-donts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #111;
  border-top: 1px solid rgba(242,237,228,0.06);
}

.dos { padding: 10px 12px; border-right: 1px solid rgba(242,237,228,0.06); }
.donts { padding: 10px 12px; }

.dos-title { font-size: 6.5px; letter-spacing: 0.35em; text-transform: uppercase; color: #4CAF50; margin-bottom: 6px; }
.donts-title { font-size: 6.5px; letter-spacing: 0.35em; text-transform: uppercase; color: #C0001A; margin-bottom: 6px; }

.do-item, .dont-item {
  font-size: 7.5px;
  color: rgba(242,237,228,0.55);
  padding: 2px 0;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  line-height: 1.5;
}

.do-icon { color: #4CAF50; flex-shrink: 0; }
.dont-icon { color: #C0001A; flex-shrink: 0; }

.editorial-footer {
  padding: 14px 16px;
  background: #080808;
  border-top: 1px solid rgba(242,237,228,0.06);
  display: flex;
  align-items: center;
  gap: 10px;
}

.editorial-quote {
  font-family: 'Cormorant Garamond', serif;
  font-size: 13px;
  font-style: italic;
  font-weight: 300;
  color: rgba(242,237,228,0.7);
  flex: 1;
  line-height: 1.4;
}

.confidence-block {
  text-align: center;
  flex-shrink: 0;
}

.confidence-num {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 300;
  color: #C0001A;
  line-height: 1;
}

.confidence-label {
  font-size: 6px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(242,237,228,0.3);
}
</style>
<body>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 1: COLORIMETRY
════════════════════════════════════════════════════════════ -->
<div class="page page-dark">

  <!-- Header with image -->
  <div class="header">
    <div class="header-text">
      <div class="brand">Runway</div>
      <h1>Análisis<br>Visual</h1>
      <p class="section-label">Imagen Personal</p>
      <div class="badge-row">
        <span class="badge">${c.faceShape || h.faceShape || 'Oval'}</span>
        <span class="badge">${c.skinUndertone || 'Neutral'}</span>
        <span class="badge">${c.contrastLevel || 'Medium'} Contrast</span>
      </div>
    </div>
    <img src="${imgs[0]}" class="header-img" alt="Portrait" />
  </div>

  <!-- Seasons -->
  <div class="seasons-block">
    <p class="seasons-title">1. Colorimetría · Estaciones</p>
    <div class="seasons-grid">
      ${['Spring', 'Summer', 'Autumn', 'Winter'].map(s => `
        <div class="season-card ${c.season === s ? 'active' : ''}">
          <img src="${imgs[0]}" class="season-img" alt="${s}" />
          <span class="season-name">${s === 'Spring' ? 'Primavera' : s === 'Summer' ? 'Verano' : s === 'Autumn' ? 'Otoño' : 'Invierno'}</span>
          <span class="season-sub">${s === 'Spring' ? 'Cálida·Clara' : s === 'Summer' ? 'Fría·Clara' : s === 'Autumn' ? 'Cálida·Profunda' : 'Fría·Profunda'}</span>
          ${c.season === s ? '<div style="position:absolute;top:4px;right:4px;width:12px;height:12px;background:#C0001A;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;color:white;">✓</div>' : ''}
        </div>
      `).join('')}
    </div>
    <p class="best-season-label">★ Best season: <strong>${c.seasonSubtype || c.season || 'Winter'}</strong></p>
  </div>

  <!-- Favorable colors -->
  <div class="colors-section">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
      <div style="padding-right:8px;border-right:1px solid rgba(242,237,228,0.06);">
        <p class="col-label favorable-label">Favorable ✓</p>
        <div style="display:flex;gap:3px;flex-wrap:wrap;">
          ${bestColors.map((hex: string, i: number) => `
            <div style="text-align:center;width:36px;">
              <div style="position:relative;width:36px;height:44px;overflow:hidden;">
                <img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/>
                <div style="position:absolute;inset:0;background:${hex};opacity:0.65;mix-blend-mode:multiply;"></div>
              </div>
              <div style="width:7px;height:7px;border-radius:50%;background:${hex};margin:2px auto 1px;"></div>
              <div style="font-size:5px;color:rgba(242,237,228,0.4);letter-spacing:0.05em;text-transform:uppercase;line-height:1.3;">${(c.colorAnalysis?.bestColorNames?.[i] || '').split(' ').slice(0,2).join(' ')}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="padding-left:8px;">
        <p class="col-label avoid-label">Avoid ✗</p>
        <div style="display:flex;gap:3px;flex-wrap:wrap;">
          ${avoidColors.map((hex: string, i: number) => `
            <div style="text-align:center;width:36px;">
              <div style="position:relative;width:36px;height:44px;overflow:hidden;">
                <img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;object-position:center top;filter:grayscale(40%)"/>
                <div style="position:absolute;inset:0;background:${hex};opacity:0.7;mix-blend-mode:multiply;"></div>
              </div>
              <div style="width:7px;height:7px;border-radius:50%;background:${hex};margin:2px auto 1px;"></div>
              <div style="font-size:5px;color:rgba(242,237,228,0.3);letter-spacing:0.05em;text-transform:uppercase;line-height:1.3;">${(c.colorAnalysis?.avoidColorNames?.[i] || '').split(' ').slice(0,2).join(' ')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Metals -->
  <div class="metals-row">
    <div class="metal-item">
      <div class="metal-circle silver-circle"></div>
      <div class="metal-label">Silver</div>
      <div class="metal-verdict">${c.metals?.best?.toLowerCase().includes('silver') ? '✓ Recommended' : '○ Optional'}</div>
    </div>
    <div style="width:1px;background:rgba(242,237,228,0.06);"></div>
    <div class="metal-item">
      <div class="metal-circle gold-circle"></div>
      <div class="metal-label">Gold</div>
      <div class="metal-verdict">${c.metals?.best?.toLowerCase().includes('gold') ? '✓ Recommended' : '○ Optional'}</div>
    </div>
  </div>

  <!-- Undertone + Palette -->
  <div class="undertone-palette">
    <div class="ut-row">
      <div>
        <div class="ut-label">Skin undertone</div>
        <div class="ut-value">${c.skinUndertone || 'Neutral'}</div>
      </div>
      <div>
        <div class="ut-label">Personal palette</div>
        <div class="ut-value" style="font-size:13px;">${c.seasonSubtype || c.season || 'Deep Winter'}</div>
      </div>
    </div>
    <div>
      <div style="font-size:6.5px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin:8px 0 4px;">Basics</div>
      <div class="palette-row">
        ${(c.colorAnalysis?.neutralColors || bestColors.slice(0,3)).slice(0,3).map((hex: string) => `<div class="palette-swatch" style="background:${hex};"></div>`).join('')}
      </div>
      <div style="font-size:6.5px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin:6px 0 4px;">Accents</div>
      <div class="palette-row">
        ${(c.colorAnalysis?.accentColors || bestColors.slice(3,6)).slice(0,4).map((hex: string) => `<div class="palette-swatch" style="background:${hex};"></div>`).join('')}
      </div>
    </div>
  </div>

</div><!-- end page 1 -->


<!-- ═══════════════════════════════════════════════════════════
     PAGE 2: HAIRSTYLES
════════════════════════════════════════════════════════════ -->
<div class="page page-dark">

  <!-- Hair header -->
  <div class="hair-header">
    <div class="face-shape-diagram">
      <div class="face-oval"></div>
      <p style="font-size:6px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(242,237,228,0.4);text-align:center;margin-bottom:5px;">${h.faceShape || 'Oval'}</p>
      <div class="face-checks">
        ${(h.faceProportions || ['Balanced proportions', 'High cheekbones', 'Versatile shape']).slice(0,4).map((p: string) => `
          <div class="face-check"><span class="check-green">✓</span> ${p.substring(0,24)}</div>
        `).join('')}
      </div>
    </div>
    <div>
      <div class="brand">Runway</div>
      <h2 style="font-family:'Cormorant Garamond',serif;font-size:20px;font-style:italic;font-weight:300;color:#F2EDE4;margin-bottom:5px;">Análisis<br>de Peinados</h2>
      <p class="section-label">Asesor de Imagen Premium</p>
    </div>
  </div>

  <!-- Avoid -->
  <div class="hair-avoid-section">
    <p style="font-size:6.5px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(192,0,26,0.8);margin-bottom:6px;">Menos Favorecedores</p>
    <div class="avoid-grid">
      ${(h.hairsToAvoid || []).slice(0,6).map((item: any, i: number) => `
        <div class="avoid-card">
          <div style="position:relative;">
            <img src="${refHairstyles[i+5] || imgs[0]}" class="avoid-img" alt="${item.name}" />
            <div class="avoid-x">✗</div>
          </div>
          <div class="avoid-name">${item.name?.substring(0,16)}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Favorable -->
  <div class="favorable-section">
    <div class="favorable-label-block">Más Favorecedores</div>
    <div class="favorable-grid">
      ${bestHairstyles.map((item: any, i: number) => `
        <div class="favorable-card">
          <img src="${refHairstyles[i] || imgs[0]}" class="favorable-img" alt="${item.name}" />
          <div class="check-badge">✓</div>
          <div class="favorable-name">${item.name?.split(' ').slice(0,3).join(' ')}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Tips -->
  <div class="tips-row">
    <div class="tip-item">
      <div class="tip-icon">✂</div>
      <div class="tip-text">${h.hairCareRecommendations?.technique || 'Layers & texture for movement'}</div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">◌</div>
      <div class="tip-text">${h.hairCareRecommendations?.volume || 'Natural volume on top'}</div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">▣</div>
      <div class="tip-text">${(h.hairCareRecommendations?.products || ['Matte products'])[0]}</div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">⊙</div>
      <div class="tip-text">${(h.hairCareRecommendations?.techniques || ['Blow dry with direction'])[0]}</div>
    </div>
  </div>

  <!-- Ranking + Glow Up -->
  <div class="ranking-section">
    <div class="ranking-list">
      <p class="ranking-title">★ Ranking Top ${Math.min(bestHairstyles.length, 5)}</p>
      ${bestHairstyles.slice(0,5).map((item: any, i: number) => `
        <div class="rank-item">
          <div class="rank-num ${i === 0 ? 'gold' : ''}">${i+1}</div>
          <img src="${refHairstyles[i] || imgs[0]}" class="rank-thumb" alt="${item.name}" />
          <div>
            <div class="rank-label">${item.name?.substring(0,18)}</div>
            <div class="stars">${'★'.repeat(item.rating || (5-i))}${'☆'.repeat(5-(item.rating || (5-i)))}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="glowup-section">
      <p class="glowup-title">Antes vs Glow Up</p>
      <div class="glowup-compare">
        <div>
          <img src="${imgs[0]}" class="glowup-img" alt="Before" style="filter:grayscale(50%);" />
          <div class="glowup-label">Antes</div>
        </div>
        <div style="text-align:center;">
          <div class="vs-badge">VS</div>
        </div>
        <div>
          <img src="${imgs[0]}" class="glowup-img" alt="After" />
          <div class="glowup-label after">Glow Up ✓</div>
        </div>
      </div>
      <p style="font-size:6px;color:rgba(242,237,228,0.3);text-align:center;margin-top:5px;letter-spacing:0.1em;">${h.editorialVerdict?.substring(0,80) || 'Wear your best version.'}</p>
    </div>
  </div>

</div><!-- end page 2 -->


<!-- ═══════════════════════════════════════════════════════════
     PAGE 3: PERSONAL STYLE
════════════════════════════════════════════════════════════ -->
<div class="page page-dark">

  <div class="style-header">
    <div>
      <div class="brand">Runway</div>
      <h2 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;font-weight:300;color:#F2EDE4;margin-bottom:5px;">Estilo<br>Personal</h2>
      <p class="section-label">Guía editorial de imagen</p>
    </div>
    <img src="${imgs[1] || imgs[0]}" style="width:72px;height:88px;object-fit:cover;object-position:center top;filter:grayscale(20%);" alt="Style" />
  </div>

  <!-- Analysis badges -->
  <div style="background:#111;padding:10px 16px;border-top:1px solid rgba(242,237,228,0.06);">
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      ${[
        { l: 'Face', v: h.faceShape || 'Oval' },
        { l: 'Contrast', v: c.contrastLevel || 'High' },
        { l: 'Undertone', v: c.skinUndertone || 'Cool' },
        { l: 'Season', v: c.season || 'Winter' },
      ].map(b => `
        <div style="border:1px solid rgba(242,237,228,0.1);padding:4px 8px;text-align:center;">
          <div style="font-size:5.5px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin-bottom:1px;">${b.l}</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:12px;font-style:italic;color:#F2EDE4;">${b.v}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Palette Recommendation -->
  <div class="palette-recom">
    <p class="palette-label">Recommended palette</p>
    <div class="palette-big-row">
      ${bestColors.slice(0,8).map((hex: string) => `
        <div class="palette-big-swatch" style="background:${hex};">
          <span class="swatch-hex">${hex.substring(1,4)}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Outfit Categories -->
  <div style="padding:8px 16px 0;background:#0a0a0a;border-top:1px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin-bottom:8px;">Outfit Styles</p>
  </div>
  <div class="outfit-grid" style="background:#0a0a0a;padding:0 16px 8px;">
    ${outfitCategories.map((cat: any) => `
      <div class="outfit-cat">
        <div class="outfit-cat-name">${cat.category?.toUpperCase()}</div>
        <ul class="outfit-pieces">
          ${(cat.keyPieces || []).slice(0,3).map((p: string) => `<li class="outfit-piece">${p}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  </div>

  <!-- Do's & Don'ts -->
  <div class="dos-donts">
    <div class="dos">
      <p class="dos-title">✓ Sí</p>
      ${[
        'Colores neutros',
        'Ropa bien ajustada',
        'Capas con intención',
        'Calzado limpio',
      ].map(d => `<div class="do-item"><span class="do-icon">✓</span>${d}</div>`).join('')}
    </div>
    <div class="donts">
      <p class="donts-title">✗ Evitar</p>
      ${[
        'Ropa muy holgada',
        'Estampados grandes',
        'Colores muy vivos',
        'Accesorios excesivos',
      ].map(d => `<div class="dont-item"><span class="dont-icon">✗</span>${d}</div>`).join('')}
    </div>
  </div>

  <!-- Key pieces row -->
  <div style="padding:10px 16px;background:#111;border-top:1px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin-bottom:8px;">Prendas Clave</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      ${['Trench coat', 'Pantalón recto', 'Polo / Tejido', 'Sneakers clean', 'Camiseta básica'].map(p => `
        <span style="border:1px solid rgba(242,237,228,0.12);padding:4px 8px;font-size:7px;letter-spacing:0.15em;color:rgba(242,237,228,0.6);text-transform:uppercase;">${p}</span>
      `).join('')}
    </div>
  </div>

  <!-- Color base row -->
  <div style="padding:10px 16px;background:#0c0c0c;border-top:1px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin-bottom:6px;">Base Colors</p>
    <div style="display:flex;gap:4px;">
      ${bestColors.slice(0,6).map((hex: string, i: number) => `
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
          <div style="width:14px;height:14px;background:${hex};flex-shrink:0;"></div>
          <span style="font-size:6px;color:rgba(242,237,228,0.4);letter-spacing:0.1em;">${c.colorAnalysis?.bestColorNames?.[i]?.substring(0,10) || hex}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Editorial footer -->
  <div class="editorial-footer">
    <p class="editorial-quote">"${c.editorialNote || c.stylePersonality?.substring(0, 90) || 'Your style is a statement. Wear it with intention.'}"</p>
    <div class="confidence-block">
      <div class="confidence-num">${c.confidenceScore || 88}%</div>
      <div class="confidence-label">Confidence</div>
    </div>
  </div>

</div><!-- end page 3 -->


</div><!-- end page 3 -->

<!-- ═══════════════════════════════════════════════════════════
     PAGE 4: ACCESSORIES + MAKEUP
════════════════════════════════════════════════════════════ -->
<div class="page page-dark">

  <div style="background:#111;padding:14px 16px;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <div class="brand">Runway</div>
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:20px;font-style:italic;font-weight:300;color:#F2EDE4;margin:4px 0 2px;">Accesorios<br>& Maquillaje</h2>
    <p style="font-size:6px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(242,237,228,0.3);">Guía editorial completa</p>
  </div>

  <!-- Accessories -->
  <div style="padding:10px 16px;background:#0e0e0e;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:8px;">Accesorios</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      ${[
        { icon: '○', label: 'Joyería', val: c.accessories?.jewelry || 'Ver paleta de metales' },
        { icon: '□', label: 'Carteras', val: c.accessories?.bags || 'Estructuradas en tono neutro' },
        { icon: '△', label: 'Calzado', val: c.accessories?.shoes || 'Limpio y preciso' },
        { icon: '◇', label: 'Accesorios', val: c.accessories?.scarves || 'Mínimos y de calidad' },
      ].map(a => `
        <div style="border:0.5px solid rgba(242,237,228,0.1);padding:8px 10px;">
          <div style="font-size:10px;color:rgba(242,237,228,0.25);margin-bottom:3px;">${a.icon}</div>
          <div style="font-size:6px;letter-spacing:0.32em;text-transform:uppercase;color:rgba(242,237,228,0.4);margin-bottom:3px;">${a.label}</div>
          <div style="font-size:8px;color:rgba(242,237,228,0.7);line-height:1.5;">${a.val}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Makeup -->
  <div style="padding:10px 16px;background:#111;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:8px;">Paleta de Maquillaje</p>
    <div style="display:grid;gap:6px;">
      ${[
        { label: 'Base', val: c.makeupPalette?.foundation || '-' },
        { label: 'Labios', val: (c.makeupPalette?.lips || []).join(' · ') || '-' },
        { label: 'Sombras', val: (c.makeupPalette?.eyeshadow || []).join(' · ') || '-' },
        { label: 'Rubor', val: c.makeupPalette?.blush || '-' },
        { label: 'Iluminador', val: c.makeupPalette?.highlight || '-' },
        { label: 'Evitar', val: c.makeupPalette?.avoid || '-' },
      ].map(m => `
        <div style="display:grid;grid-template-columns:70px 1fr;gap:8px;border-bottom:0.5px solid rgba(242,237,228,0.05);padding-bottom:5px;">
          <div style="font-size:6px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(242,237,228,0.35);">${m.label}</div>
          <div style="font-size:8px;color:rgba(242,237,228,0.65);line-height:1.5;">${m.val}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Style rationale -->
  <div style="padding:10px 16px;background:#0a0a0a;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:6px;">Season Rationale</p>
    <p style="font-size:9px;color:rgba(242,237,228,0.6);line-height:1.7;font-style:italic;">${c.seasonRationale || c.stylePersonality || ''}</p>
  </div>

  <!-- Keywords -->
  <div style="padding:10px 16px;background:#111;">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:8px;">Style Keywords</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      ${(c.styleKeywords || ['Editorial','Precise','Intentional','Luxe','Minimal']).map((kw: string) => `
        <span style="border:0.5px solid rgba(242,237,228,0.18);padding:4px 10px;font-size:7px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(242,237,228,0.6);">${kw}</span>
      `).join('')}
    </div>
  </div>

  <!-- Editorial footer -->
  <div style="padding:12px 16px;background:#080808;border-top:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-family:'Cormorant Garamond',serif;font-size:12px;font-style:italic;color:rgba(242,237,228,0.6);line-height:1.4;">"${c.editorialNote || 'Dress with intention. Always.'}"</p>
    <p style="font-size:7px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(192,0,26,0.7);margin-top:6px;">${c.runwayVerdict || "That's all."}</p>
  </div>

</div><!-- end page 4 -->


<!-- ═══════════════════════════════════════════════════════════
     PAGE 5: STYLE ERRORS + CORRECTIONS
════════════════════════════════════════════════════════════ -->
<div class="page page-dark">

  <div style="background:#111;padding:14px 16px;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <div class="brand">Runway</div>
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:20px;font-style:italic;font-weight:300;color:#F2EDE4;margin:4px 0 2px;">Errores<br>& Soluciones</h2>
    <p style="font-size:6px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(242,237,228,0.3);">Optimización de imagen personal</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">

    <!-- Errors -->
    <div style="padding:12px 14px;border-right:0.5px solid rgba(242,237,228,0.06);background:#0e0e0e;">
      <p style="font-size:6.5px;letter-spacing:0.38em;text-transform:uppercase;color:#C0001A;margin-bottom:10px;">✗ Errores a evitar</p>
      ${(c.styleErrors || ['Colores que apagan','Ropa sin estructura','Paletas incorrectas','Accesorios excesivos']).map((e: string) => `
        <div style="display:flex;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:0.5px solid rgba(242,237,228,0.05);">
          <span style="color:#C0001A;font-size:10px;flex-shrink:0;line-height:1.4;">✗</span>
          <p style="font-size:8px;color:rgba(242,237,228,0.6);line-height:1.6;">${e}</p>
        </div>
      `).join('')}
    </div>

    <!-- Corrections -->
    <div style="padding:12px 14px;background:#0a0a0a;">
      <p style="font-size:6.5px;letter-spacing:0.38em;text-transform:uppercase;color:#4CAF50;margin-bottom:10px;">✓ Correcciones clave</p>
      ${(c.styleCorrections || ['Colores de tu estación','Prendas ajustadas','Paleta personal','Accesorios precisos']).map((e: string) => `
        <div style="display:flex;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:0.5px solid rgba(242,237,228,0.05);">
          <span style="color:#4CAF50;font-size:10px;flex-shrink:0;line-height:1.4;">✓</span>
          <p style="font-size:8px;color:rgba(242,237,228,0.6);line-height:1.6;">${e}</p>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Hair color section -->
  <div style="padding:10px 16px;background:#111;border-top:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:8px;">Color de Cabello</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
      <div style="padding:8px;border:0.5px solid rgba(242,237,228,0.1);">
        <div style="font-size:6px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin-bottom:4px;">Actual</div>
        <div style="font-size:8px;color:rgba(242,237,228,0.65);line-height:1.5;">${h.hairColor?.current || 'Natural'}</div>
      </div>
      <div style="padding:8px;border:0.5px solid rgba(76,175,80,0.3);background:rgba(76,175,80,0.05);">
        <div style="font-size:6px;letter-spacing:0.28em;text-transform:uppercase;color:#4CAF50;margin-bottom:4px;">Recomendado</div>
        <div style="font-size:8px;color:rgba(242,237,228,0.65);line-height:1.5;">${(h.hairColor?.recommended || []).join(' / ')}</div>
      </div>
      <div style="padding:8px;border:0.5px solid rgba(192,0,26,0.3);background:rgba(192,0,26,0.05);">
        <div style="font-size:6px;letter-spacing:0.28em;text-transform:uppercase;color:#C0001A;margin-bottom:4px;">Evitar</div>
        <div style="font-size:8px;color:rgba(242,237,228,0.65);line-height:1.5;">${(h.hairColor?.avoid || []).join(' / ')}</div>
      </div>
    </div>
  </div>

  <!-- User photo + final verdict -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;background:#080808;border-top:0.5px solid rgba(242,237,228,0.06);">
    <div style="padding:12px 14px;border-right:0.5px solid rgba(242,237,228,0.06);">
      <img src="${imgs[2] || imgs[0]}" style="width:100%;height:110px;object-fit:cover;object-position:center top;" />
    </div>
    <div style="padding:12px 14px;display:flex;flex-direction:column;justify-content:center;">
      <p style="font-size:6px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(242,237,228,0.3);margin-bottom:6px;">Veredicto editorial</p>
      <p style="font-family:'Cormorant Garamond',serif;font-size:12px;font-style:italic;color:rgba(242,237,228,0.8);line-height:1.5;">"${h.editorialVerdict || 'Your face tells the whole story.'}"</p>
      <div style="width:24px;height:1px;background:#C0001A;margin-top:10px;"></div>
      <p style="font-size:6px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(192,0,26,0.6);margin-top:6px;">Runway · ${c.seasonSubtype || c.season || 'Analysis'}</p>
    </div>
  </div>

</div><!-- end page 5 -->




<!-- ═══════════════════════════════════════════════════════════
     PAGE 6: VESTIMENTA — OUTFITS VISUALES
════════════════════════════════════════════════════════════ -->
<div class="page page-dark">

  <div style="background:#111;padding:14px 16px;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <div class="brand">Runway</div>
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:20px;font-style:italic;font-weight:300;color:#F2EDE4;margin:4px 0 2px;">Vestimenta<br>& Outfits</h2>
    <p style="font-size:6px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(242,237,228,0.3);">Guía visual de prendas · ${c.seasonSubtype || c.season || 'Personal Season'}</p>
  </div>

  <!-- Outfit grid with images -->
  <div style="background:#0a0a0a;padding:10px 16px;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:10px;">Looks Recomendados</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${(c.outfitStyles || []).slice(0,4).map((cat: any, i: number) => `
        <div style="background:#111;border:0.5px solid rgba(242,237,228,0.08);overflow:hidden;">
          ${refOutfits[i]
            ? `<img src="${refOutfits[i]}" style="width:100%;height:110px;object-fit:cover;object-position:center top;" />`
            : `<div style="width:100%;height:110px;background:linear-gradient(135deg,#1a1a1a,#0e0e0e);display:flex;align-items:center;justify-content:center;">
                <div style="text-align:center;">
                  <div style="font-size:20px;color:rgba(242,237,228,0.1);margin-bottom:4px;">◻</div>
                  <div style="font-size:6px;color:rgba(242,237,228,0.15);letter-spacing:0.2em;text-transform:uppercase;">Outfit ${i+1}</div>
                </div>
              </div>`
          }
          <div style="padding:8px 10px;">
            <div style="font-size:6px;letter-spacing:0.32em;text-transform:uppercase;color:rgba(242,237,228,0.4);margin-bottom:4px;border-bottom:0.5px solid rgba(192,0,26,0.3);padding-bottom:3px;">${cat.category || 'Style'}</div>
            <div style="font-size:7.5px;color:rgba(242,237,228,0.55);line-height:1.6;">${(cat.keyPieces || []).map((p: string) => `— ${p}`).join('<br/>')}</div>
            ${cat.colorDirection ? `<div style="font-size:6.5px;color:rgba(192,0,26,0.7);margin-top:4px;letter-spacing:0.05em;font-style:italic;">${cat.colorDirection}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Key pieces visual strip -->
  <div style="background:#111;padding:10px 16px;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:8px;">Prendas Clave · Tu Guardarropa Esencial</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
      ${[
        { icon: '▣', label: 'Básico 1', val: (c.outfitStyles?.[0]?.keyPieces?.[0]) || 'Prenda básica' },
        { icon: '▣', label: 'Básico 2', val: (c.outfitStyles?.[0]?.keyPieces?.[1]) || 'Prenda básica' },
        { icon: '▣', label: 'Básico 3', val: (c.outfitStyles?.[1]?.keyPieces?.[0]) || 'Prenda básica' },
        { icon: '◇', label: 'Inversión 1', val: (c.outfitStyles?.[2]?.keyPieces?.[0]) || 'Inversión' },
        { icon: '◇', label: 'Inversión 2', val: (c.outfitStyles?.[3]?.keyPieces?.[0]) || 'Inversión' },
        { icon: '◇', label: 'Inversión 3', val: (c.outfitStyles?.[3]?.keyPieces?.[1]) || 'Inversión' },
      ].map(p => `
        <div style="border:0.5px solid rgba(242,237,228,0.08);padding:7px 8px;">
          <div style="font-size:10px;color:rgba(242,237,228,0.15);margin-bottom:2px;">${p.icon}</div>
          <div style="font-size:7px;color:rgba(242,237,228,0.6);line-height:1.5;">${p.val}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Palette applied to outfits -->
  <div style="background:#0e0e0e;padding:10px 16px;border-bottom:0.5px solid rgba(242,237,228,0.06);">
    <p style="font-size:7px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(242,237,228,0.35);margin-bottom:8px;">Colores Aplicados a Vestimenta</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <div style="font-size:6px;letter-spacing:0.3em;text-transform:uppercase;color:#4CAF50;margin-bottom:5px;">✓ Usar siempre</div>
        ${(c.colorAnalysis?.bestColors || []).slice(0,4).map((hex: string, i: number) => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <div style="width:18px;height:18px;background:${hex};flex-shrink:0;border-radius:2px;"></div>
            <div>
              <div style="font-size:7px;color:rgba(242,237,228,0.65);">${c.colorAnalysis?.bestColorNames?.[i] || hex}</div>
              <div style="font-size:5.5px;color:rgba(242,237,228,0.3);letter-spacing:0.1em;">${hex}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div>
        <div style="font-size:6px;letter-spacing:0.3em;text-transform:uppercase;color:#C0001A;margin-bottom:5px;">✗ Evitar siempre</div>
        ${(c.colorAnalysis?.avoidColors || []).slice(0,4).map((hex: string, i: number) => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <div style="width:18px;height:18px;background:${hex};flex-shrink:0;border-radius:2px;opacity:0.6;"></div>
            <div>
              <div style="font-size:7px;color:rgba(242,237,228,0.45);">${c.colorAnalysis?.avoidColorNames?.[i] || hex}</div>
              <div style="font-size:5.5px;color:rgba(242,237,228,0.25);letter-spacing:0.1em;">${hex}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Final runway sign-off -->
  <div style="background:#080808;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-top:0.5px solid rgba(242,237,228,0.06);">
    <div>
      <p style="font-family:'Cormorant Garamond',serif;font-size:11px;font-style:italic;color:rgba(242,237,228,0.5);line-height:1.5;">Dress the body you have.<br>Color the season you are.</p>
      <div style="width:24px;height:1px;background:#C0001A;margin-top:6px;"></div>
    </div>
    <div style="text-align:right;">
      <div style="font-family:'Cormorant Garamond',serif;font-size:11px;letter-spacing:0.5em;text-transform:uppercase;color:rgba(242,237,228,0.3);">Runway</div>
      <div style="font-size:6px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(192,0,26,0.5);margin-top:3px;">${c.seasonSubtype || c.season} · ${c.confidenceScore || 88}% confidence</div>
    </div>
  </div>

</div><!-- end page 6 -->


</body>
</html>`
}

export async function generatePDF(data: {
  colorimetry: any
  hairstyle: any
  imageBase64: string[]
  lang: string
  referenceImages?: { hairstyles: (string|null)[]; outfits: (string|null)[] }
}): Promise<string> {
  const html = generateReportHTML(data)
  const filename = `report-${uuid()}.pdf`
  const outputPath = path.join(REPORTS_DIR, filename)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 1500)) // wait for Google Fonts

    await page.pdf({
      path: outputPath,
      width: '390px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
  } finally {
    await browser.close()
  }

  return `/reports/${filename}`
}
