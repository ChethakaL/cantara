import Anthropic, { toFile } from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secure-settings'
import {
  bufferToCsvText,
  detectServiceType,
  type ParsedClientAddress,
} from '@/lib/client-location-map/parse-addresses'

function stripJsonFence(text: string) {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t)
  return fence ? fence[1].trim() : t
}

function normalizeClients(raw: unknown): ParsedClientAddress[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as any).clients)
      ? (raw as any).clients
      : null
  if (!arr) return []

  const out: ParsedClientAddress[] = []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const name = String((row as any).name ?? '').trim()
    const address = String((row as any).address ?? '').trim()
    if (!address) continue
    out.push({
      name: name || address.split(',')[0]?.trim() || 'Customer',
      address,
      serviceType: detectServiceType(String((row as any).serviceType ?? (row as any).service ?? '')),
    })
  }
  return out
}

function collectGeneratedFileIds(response: any): string[] {
  const ids: string[] = []
  for (const block of response?.content ?? []) {
    if (block?.type === 'bash_code_execution_tool_result') {
      const result = block.content
      if (result?.type === 'bash_code_execution_result') {
        for (const item of result.content ?? []) {
          if (item?.file_id) ids.push(String(item.file_id))
        }
      }
    }
    // Legacy / alternate shapes
    if (block?.type === 'code_execution_tool_result') {
      const result = block.content
      for (const item of result?.content ?? []) {
        if (item?.file_id) ids.push(String(item.file_id))
      }
    }
  }
  return ids
}

function collectText(response: any): string {
  return (response?.content ?? [])
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
}

/**
 * When native header matching fails, upload the spreadsheet to Claude Files API
 * and use the code_execution tool to emit a clean JSON address list.
 */
export async function extractAddressesWithClaudeCodeExecution(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedClientAddress[]> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    throw new Error(
      'Anthropic API key is required to parse this address file format. Add it in Admin Settings, or upload using the Cantara Customer Address List template.',
    )
  }

  const csvText = bufferToCsvText(buffer, fileName)
  if (!csvText.trim()) {
    throw new Error('Could not read any rows from the uploaded address file.')
  }

  const client = new Anthropic({
    apiKey,
    defaultHeaders: {
      'anthropic-beta': 'files-api-2025-04-14,code-execution-2025-08-25',
    },
  })

  const uploadName = fileName.toLowerCase().endsWith('.csv')
    ? fileName
    : `${fileName.replace(/\.[^.]+$/, '') || 'addresses'}.csv`

  const uploaded = await client.beta.files.upload({
    file: await toFile(Buffer.from(csvText, 'utf-8'), uploadName, { type: 'text/csv' }),
  })

  try {
    const response = await client.beta.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      betas: ['files-api-2025-04-14', 'code-execution-2025-08-25'],
      tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are parsing a pet-business customer address spreadsheet for geocoding.

Use the code_execution tool (pandas) to read the uploaded CSV and write a JSON array to $OUTPUT_DIR/addresses.json.

Each array item MUST be:
{"name":"<string>","address":"<full geocodable address>","serviceType":"boarding|daycare|grooming|both|other"}

Rules:
- Build address from whatever columns exist (street/address, city, state/province, country, zip/postal). Always include city + state/province + country + zip when present so Google Maps does not geocode ambiguous city-only strings worldwide.
- If there is no customer/client name column, use the street line (or "Customer").
- If there is no service/type column, set serviceType to "both".
- Skip blank rows.
- Do NOT invent addresses.
- After writing the file, reply with a one-line summary of how many rows were written.`,
            },
            { type: 'container_upload', file_id: uploaded.id },
          ],
        },
      ],
    })

    const fileIds = collectGeneratedFileIds(response)
    for (const fileId of fileIds) {
      try {
        const downloaded = await client.beta.files.download(fileId)
        const text = await downloaded.text()
        const parsed = JSON.parse(stripJsonFence(text))
        const clients = normalizeClients(parsed)
        if (clients.length) return clients
      } catch (err) {
        console.warn('[client-location-map] Failed reading Claude output file', fileId, err)
      }
    }

    // Fallback: sometimes the model prints JSON in the text response.
    const text = collectText(response)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        const clients = normalizeClients(JSON.parse(jsonMatch[0]))
        if (clients.length) return clients
      } catch {
        // ignore
      }
    }

    throw new Error(
      'Claude could not extract addresses from this file. Please download the Cantara Customer Address List template, fill it in, and upload again.',
    )
  } finally {
    try {
      await client.beta.files.delete(uploaded.id)
    } catch {
      // best-effort cleanup
    }
  }
}
