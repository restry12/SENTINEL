const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const MODELS = {
  large: 'mistralai/mistral-large',
  small: 'mistralai/mistral-large',
} as const

export async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sentinel.vercel.app',
      'X-Title': 'SENTINEL',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

export function parseJSON<T>(raw: string, agentName: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as T
    throw new Error(`${agentName} output no es JSON válido:\n${raw}`)
  }
}
