export type ParsedClientAddress = {
  name: string
  address: string
  serviceType: string
}

export type AddressParseResult = {
  clients: ParsedClientAddress[]
  parserMatched: boolean
  source: 'native' | 'claude'
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findHeaderIndex(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(h))
    if (idx >= 0) return idx
  }
  return -1
}

/** True when headers clearly identify address parts (Cantara template or common variants). */
export function headersMatchAddressParser(headersRaw: string[]): boolean {
  const headers = headersRaw.map(normalizeHeader)
  const addressIdx = findHeaderIndex(headers, [
    /^(full )?address$/,
    /^street address$/,
    /^street$/,
    /^location$/,
    /^mailing address$/,
  ])
  const cityIdx = findHeaderIndex(headers, [/^city$/])
  const stateIdx = findHeaderIndex(headers, [
    /^state$/,
    /^province$/,
    /^state or province$/,
    /^state\/province$/,
  ])
  const nameIdx = findHeaderIndex(headers, [
    /^customer name$/,
    /^client name$/,
    /^name$/,
    /^client$/,
    /^customer$/,
    /^business$/,
    /^company$/,
  ])

  // Explicit address/street column is enough (optionally with city/state).
  if (addressIdx >= 0) return true
  // Name + city + state without a dedicated street is still usable.
  if (nameIdx >= 0 && cityIdx >= 0 && stateIdx >= 0) return true
  return false
}

export function detectServiceType(raw: string): string {
  const lower = raw.toLowerCase().trim()
  if (!lower) return 'both'
  const isBoth =
    /both|all|full|multiple|boarding.*daycare|daycare.*boarding|boarding\s*(and|\+|&|\/)\s*daycare|board\s*(and|\+|&|\/)\s*daycare/i.test(
      lower,
    )
  if (isBoth) return 'both'
  const hasBoarding = /boarding|board|kennel|overnight|lodge|suite|stay/i.test(lower)
  const hasDaycare = /daycare|day\s*care|day\s*camp|daycamp/i.test(lower)
  if (hasBoarding && hasDaycare) return 'both'
  const hasGrooming = /groom|bath|spa|salon|wash/i.test(lower)
  if (hasBoarding) return 'boarding'
  if (hasDaycare) return 'daycare'
  if (hasGrooming) return 'grooming'
  return 'other'
}

function buildAddressFromParts(parts: {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}): string {
  const street = (parts.street || '').trim()
  const city = (parts.city || '').trim()
  const state = (parts.state || '').trim()
  const zip = (parts.zip || '').trim()
  const country = (parts.country || '').trim()

  const locality = [city, [state, zip].filter(Boolean).join(' ').trim()].filter(Boolean).join(', ')
  return [street, locality, country].filter(Boolean).join(', ').replace(/\s+,/g, ',').trim()
}

function parseRowsWithHeaderMap(
  headersRaw: string[],
  dataRows: unknown[][],
): ParsedClientAddress[] {
  const headers = headersRaw.map(normalizeHeader)

  const nameIdx = findHeaderIndex(headers, [
    /^customer name$/,
    /^client name$/,
    /^name$/,
    /^client$/,
    /^customer$/,
    /^business$/,
    /^company$/,
  ])
  const addressIdx = findHeaderIndex(headers, [
    /^(full )?address$/,
    /^street address$/,
    /^street$/,
    /^location$/,
    /^mailing address$/,
  ])
  const cityIdx = findHeaderIndex(headers, [/^city$/])
  const stateIdx = findHeaderIndex(headers, [
    /^state$/,
    /^province$/,
    /^state or province$/,
    /^state\/province$/,
  ])
  const zipIdx = findHeaderIndex(headers, [/^zip$/, /^postal$/, /^zip code$/, /^postal code$/])
  const countryIdx = findHeaderIndex(headers, [/^country$/, /^country.?region$/])
  const serviceIdx = findHeaderIndex(headers, [
    /^type$/,
    /^service$/,
    /^service type$/,
    /^category$/,
    /^service types?$/,
  ])

  const results: ParsedClientAddress[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i] ?? []
    const cell = (idx: number) => (idx >= 0 ? String(cols[idx] ?? '').trim() : '')

    const streetOrAddress = cell(addressIdx)
    const city = cell(cityIdx)
    const state = cell(stateIdx)
    const zip = cell(zipIdx)
    const country = cell(countryIdx)

    let address = ''
    if (addressIdx >= 0 && (cityIdx >= 0 || stateIdx >= 0 || zipIdx >= 0 || countryIdx >= 0)) {
      // Prefer composing full geocode string from parts when present.
      const alreadyHasCity = city && streetOrAddress.toLowerCase().includes(city.toLowerCase())
      address = alreadyHasCity
        ? [streetOrAddress, country].filter(Boolean).join(', ')
        : buildAddressFromParts({
            street: streetOrAddress,
            city,
            state,
            zip,
            country,
          })
    } else if (addressIdx >= 0) {
      address = streetOrAddress
    } else {
      address = buildAddressFromParts({
        street: '',
        city,
        state,
        zip,
        country,
      })
    }

    let name = cell(nameIdx)
    if (!name) {
      // No name column (e.g. Street Address | City | State...) — use street line.
      name = streetOrAddress || city || `Customer ${i + 1}`
    }

    if (!address) continue

    results.push({
      name,
      address,
      serviceType: detectServiceType(cell(serviceIdx)),
    })
  }

  return results
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function parseCsvText(text: string): AddressParseResult {
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean) return { clients: [], parserMatched: false, source: 'native' }

  const lines = clean.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { clients: [], parserMatched: false, source: 'native' }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const parserMatched = headersMatchAddressParser(headers)
  if (!parserMatched) {
    return { clients: [], parserMatched: false, source: 'native' }
  }

  const dataRows = lines.slice(1).map((line) => parseCsvLine(line))
  return {
    clients: parseRowsWithHeaderMap(headers, dataRows),
    parserMatched: true,
    source: 'native',
  }
}

export function parseXlsxBuffer(buffer: Buffer): AddressParseResult {
  // Lazy require keeps route startup light when only Claude path is used.
  const XLSX = require('xlsx') as typeof import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { clients: [], parserMatched: false, source: 'native' }

  const ws = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  if (rows.length < 2) return { clients: [], parserMatched: false, source: 'native' }

  // Cantara template has a title row then headers on row 2.
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const candidate = (rows[i] as unknown[]).map((h) => String(h ?? '').trim())
    if (headersMatchAddressParser(candidate)) {
      headerRowIndex = i
      break
    }
    // Also accept when normalized headers match after scanning.
    if (candidate.some((c) => /customer name|street address|^address$/i.test(c))) {
      headerRowIndex = i
      break
    }
  }

  const headers = (rows[headerRowIndex] as unknown[]).map((h) => String(h ?? '').trim())
  const parserMatched = headersMatchAddressParser(headers)
  if (!parserMatched) {
    return { clients: [], parserMatched: false, source: 'native' }
  }

  const dataRows = rows.slice(headerRowIndex + 1) as unknown[][]
  return {
    clients: parseRowsWithHeaderMap(headers, dataRows),
    parserMatched: true,
    source: 'native',
  }
}

/** Convert workbook/CSV buffer to UTF-8 CSV text for Claude code execution upload. */
export function bufferToCsvText(buffer: Buffer, fileName: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (ext === 'csv' || ext === 'txt') {
    return buffer.toString('utf-8')
  }

  const XLSX = require('xlsx') as typeof import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return ''
  return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
}

export function peekHeadersFromBuffer(buffer: Buffer, fileName: string): string[] {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (ext === 'csv' || ext === 'txt') {
    const first = buffer.toString('utf-8').replace(/^\uFEFF/, '').split(/\r?\n/)[0] || ''
    return parseCsvLine(first).map((h) => h.trim())
  }
  const XLSX = require('xlsx') as typeof import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
  })
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const candidate = (rows[i] as unknown[]).map((h) => String(h ?? '').trim())
    if (candidate.some(Boolean)) return candidate
  }
  return []
}
