import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, AuthorityReport } from '@sentinel/types'
import { generateReport } from './analyze'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest

  const riskAssessment = body.riskAssessment
  const expansion = body.expansion
  const airAlerts = body.airAlerts

  if (!riskAssessment || !expansion || !airAlerts) {
    res.status(400).json({
      success: false,
      data: null,
      error: 'agent-report requires riskAssessment, expansion, and airAlerts',
    } satisfies AgentResponse<AuthorityReport>)
    return
  }

  try {
    const data = await generateReport(riskAssessment, expansion, airAlerts)
    res.json({ success: true, data } satisfies AgentResponse<AuthorityReport>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<AuthorityReport>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-report' }))

const PORT = process.env.PORT ?? 3005
app.listen(PORT, () => console.log(`[agent-report] running on port ${PORT}`))
