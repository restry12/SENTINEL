# News Aesthetic Polishing Plan

**Goal:** Elevate the "Sentinel Intelligence" look with high-fidelity tactical animations, digital noise, and improved image relevance.

**Architecture:** Add custom CSS animations for "tactical flicker" and "digital grain," and refine the keyword mapping for more accurate stock imagery.

---

### Task 1: Add Tactical Animations and Noise

**Files:**
- Modify: `frontend/app/news/page.tsx`

- [ ] **Step 1: Inject custom tactical CSS**
Add a `<style>` block at the top of the file or within the component to handle the flicker and noise animations.

- [ ] **Step 2: Update HUDWrapper with Noise and Flicker**
Add a granular noise overlay and apply the flicker animation to brackets and data readouts.

- [ ] **Step 3: Refine Category Keywords**
Expand keywords to ensure Unsplash/Picsum returns more dramatic and relevant imagery.

---
### Task 2: Refine Component Logic

**Files:**
- Modify: `frontend/app/news/page.tsx`

- [ ] **Step 1: Optimize ArticleImagePlaceholder**
Ensure the "SIGNAL LOST" state feels like an intentional part of the OS (adding a "re-scanning" animation).

- [ ] **Step 2: Global Consistency**
Verify that the `FeaturedCard` and `ArticleCard` transitions are smooth.
