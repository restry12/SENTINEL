import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import type { 
  AgentResponse, 
  GlacierAnalysis, 
  GlacierInfo, 
  GlacierMassData,
  GeoJSONFeature
} from '@sentinel/types';
import { analyzeGlacier } from './analyze';
import { getRiskCategory } from './risk-calculator';

const app = express();
app.use(express.json());

const DATA_DIR = path.join(__dirname, '../data');

// GET /glaciers: Load and return catalog
app.get('/glaciers', async (_req, res) => {
  try {
    const catalogPath = path.join(DATA_DIR, 'glaciers-catalog.json');
    const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf-8'));
    res.json({ success: true, data: catalog } satisfies AgentResponse<GlacierInfo[]>);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<null>);
  }
});

// GET /glaciers/risk-grid: Return GeoJSON with centroids and risk categories
app.get('/glaciers/risk-grid', async (_req, res) => {
  try {
    const catalogPath = path.join(DATA_DIR, 'glaciers-catalog.json');
    const massPath = path.join(DATA_DIR, 'copernicus-processed.json');
    
    const catalog: GlacierInfo[] = JSON.parse(await fs.readFile(catalogPath, 'utf-8'));
    const allMassData: Record<string, GlacierMassData[]> = JSON.parse(await fs.readFile(massPath, 'utf-8'));

    const features: GeoJSONFeature[] = catalog.map(glacier => {
      const history = allMassData[glacier.id] || [];
      const lastMassChange = history[history.length - 1]?.mass_change_mmwe || 0;
      
      // Simple risk proxy based ONLY on mass change as per instruction
      let score = 0;
      if (lastMassChange < -1500) score = 80;
      else if (lastMassChange < -1000) score = 60;
      else if (lastMassChange < -500) score = 40;
      else if (lastMassChange < 0) score = 20;
      
      const category = getRiskCategory(score);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [glacier.lon, glacier.lat]
        },
        properties: {
          id: glacier.id,
          name: glacier.name,
          riskCategory: category,
          lastMassChange
        }
      };
    });

    const geojson = {
      type: 'FeatureCollection',
      features
    };

    res.json({ success: true, data: geojson } satisfies AgentResponse<any>);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<null>);
  }
});

// POST /analyze: Expects { glacierId }
app.post('/analyze', async (req, res) => {
  const { glacierId } = req.body;

  if (!glacierId) {
    return res.status(400).json({ success: false, data: null, error: 'glacierId is required' } satisfies AgentResponse<null>);
  }

  try {
    const data = await analyzeGlacier(glacierId);
    res.json({ success: true, data } satisfies AgentResponse<GlacierAnalysis>);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<null>);
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agent-glacier' });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`[agent-glacier] running on port ${PORT}`);
});
