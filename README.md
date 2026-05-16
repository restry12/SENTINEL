# SENTINEL - Wildfire Response System

AI-powered wildfire early warning system for Latin America.

## 🛠 Local Development Setup

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **pnpm**
- **Mapbox Token**: Get one at [mapbox.com](https://www.mapbox.com/)
- **Supabase Project**: Set up a PostgreSQL database with real-time enabled.

### 2. Environment Variables
Create a `frontend/.env.local` file with the following keys:

```bash
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Installation & Execution

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Repository Structure

- `frontend/`: Next.js application (Dashboards, Mapbox, UI).
- `docs/superpowers/`: Design specs and implementation plans.
- `zavu/`: SMS and Alert system scripts.

## 🛰 Technologies
- **Next.js 15+** (App Router)
- **Mapbox GL JS** (Satellite monitoring)
- **Supabase** (Real-time database)
- **Tailwind CSS** (Cyberpunk/Military UI)
