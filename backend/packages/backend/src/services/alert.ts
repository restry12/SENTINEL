import type { AlertPayload } from '@sentinel/types'

export async function triggerMakeWebhook(payload: AlertPayload): Promise<void> {
  const url = process.env.MAKE_WEBHOOK_URL
  if (!url) return // not configured — skip silently

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[alert] Make.com webhook failed: ${res.status}`)
    }
  } catch (err) {
    // Webhook failure must not propagate into the analysis error path
    console.error('[alert] Make.com webhook error:', err)
  }
}
