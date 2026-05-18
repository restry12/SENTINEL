# News Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the news section from simple color gradients to high-quality stock images with a "Sentinel Intelligence" HUD overlay (scanlines, data brackets, and tonal filters).

**Architecture:** Update the `ArticleImagePlaceholder` component to generate dynamic Unsplash URLs based on article keywords and overlay a HUD-style UI using CSS grid and absolute positioning.

**Tech Stack:** Next.js (React), Tailwind CSS, Unsplash Source API (keyword-based).

---

### Task 1: Enhance Keyword Mapping and Color Logic

**Files:**
- Modify: `frontend/app/news/page.tsx`

- [ ] **Step 1: Update article categorization logic**
Add more robust keyword detection to support better image searching and thematic coloring.

```typescript
function getArticleCategory(title: string): 'fire' | 'air' | 'water' | 'earth' | 'general' {
  const t = title.toLowerCase()
  if (t.includes('incendio') || t.includes('fuego') || t.includes('quema') || t.includes('fire') || t.includes('calor'))
    return 'fire'
  if (t.includes('contaminaci') || t.includes('calidad') || t.includes('aire') || t.includes('smog') || t.includes('air') || t.includes('particul'))
    return 'air'
  if (t.includes('lluvia') || t.includes('inundaci') || t.includes('agua') || t.includes('flood') || t.includes('rain') || t.includes('storm'))
    return 'water'
  if (t.includes('sismo') || t.includes('terremoto') || t.includes('earthquake') || t.includes('volc'))
    return 'earth'
  return 'general'
}

const CATEGORY_CONFIG = {
  fire: { keywords: 'forest,fire,emergency', color: 'from-red-950/80 to-black', accent: 'text-red-500' },
  air: { keywords: 'city,smog,pollution,air', color: 'from-green-950/80 to-black', accent: 'text-green-500' },
  water: { keywords: 'flood,storm,ocean,rain', color: 'from-blue-950/80 to-black', accent: 'text-blue-500' },
  earth: { keywords: 'earthquake,volcano,nature,mountain', color: 'from-orange-950/80 to-black', accent: 'text-orange-500' },
  general: { keywords: 'news,world,technology', color: 'from-slate-900/80 to-black', accent: 'text-slate-500' }
}
```

### Task 2: Implement Sentinel HUD Image Placeholder

**Files:**
- Modify: `frontend/app/news/page.tsx`

- [ ] **Step 1: Replace ArticleImagePlaceholder with HUD implementation**
Create a complex visual component that layers a stock image, a color wash, scanlines, and UI brackets.

```tsx
function ArticleImagePlaceholder({ title, className = "" }: { title: string; className?: string }) {
  const category = getArticleCategory(title)
  const config = CATEGORY_CONFIG[category]
  const imageUrl = `https://images.unsplash.com/photo-1?auto=format&fit=crop&q=60&w=800&ixlib=rb-4.0.3&sig=${encodeURIComponent(title)}&keywords=${config.keywords}`
  
  // Use source.unsplash.com/featured/?<keywords> for simpler logic if needed, 
  // but direct unsplash photo URLs with keywords often work better in many environments.
  // Fallback to a reliable themed URL structure:
  const displayUrl = `https://source.unsplash.com/featured/800x600?${config.keywords}`

  return (
    <div className={`relative w-full h-full overflow-hidden bg-black group ${className}`}>
      {/* Background Image with Filter */}
      <img
        src={displayUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.5] contrast-[1.2] transition-transform duration-700 group-hover:scale-110 group-hover:grayscale-0"
      />
      
      {/* Tonal Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${config.color} opacity-70`} />
      
      {/* Scanlines Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />

      {/* HUD Brackets */}
      <div className="absolute inset-4 border border-white/5 pointer-events-none">
        {/* Corners */}
        <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${config.accent.replace('text-', 'border-')}/60`} />
        <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${config.accent.replace('text-', 'border-')}/60`} />
        <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${config.accent.replace('text-', 'border-')}/60`} />
        <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${config.accent.replace('text-', 'border-')}/60`} />
        
        {/* Data readout mockups */}
        <div className="absolute top-2 left-2 flex flex-col gap-0.5 opacity-40">
          <div className="w-8 h-[1px] bg-white/40" />
          <div className="w-4 h-[1px] bg-white/40" />
        </div>
        <div className="absolute bottom-2 right-2 text-[6px] font-mono text-white/30 uppercase tracking-tighter">
          SCN_RES: 1280x720<br />
          SENTINEL_V2.4
        </div>
      </div>
    </div>
  )
}
```

### Task 3: Verify and Refine Visuals

**Files:**
- Modify: `frontend/app/news/page.tsx`

- [ ] **Step 1: Check consistency in FeaturedCard and ArticleCard**
Ensure both card types benefit from the new placeholder and look cohesive.

- [ ] **Step 2: Add hover interaction to FeaturedCard image container**
Ensure the container in `FeaturedCard` also uses the same logic or similar styling if an image is provided.

- [ ] **Step 3: Test with different filter keywords**
Verify that "Incendios" and "Calidad del Aire" produce different visual results.
