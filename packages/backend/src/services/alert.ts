import type { AlertPayload } from '@sentinel/types'

export async function triggerMakeWebhook(payload: AlertPayload): Promise<void> {
  const url = process.env.MAKE_WEBHOOK_URL
  if (!url) return // skip if not configured

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
