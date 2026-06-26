'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, MapPin, Upload, X, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react'
import { Button, Card, cn } from '@/components/ui'

// ── Types ────────────────────────────────────────────────────────────────────

type ServiceType = 'boarding' | 'daycare' | 'grooming' | 'both' | 'other'

interface ClientPin {
  name: string
  address: string
  serviceType: ServiceType
  lat?: number
  lng?: number
  geocodeStatus: 'pending' | 'success' | 'failed'
}

interface MapData {
  facilityAddress: string
  facilityLat?: number
  facilityLng?: number
  clients: ClientPin[]
  generatedAt: string
}

interface Props {
  clientId: string
  clientName: string
  businessAddress: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<ServiceType, string> = {
  boarding: '#2563eb',  // blue
  daycare: '#16a34a',   // green
  grooming: '#ea580c',  // orange
  both: '#7c3aed',      // purple
  other: '#64748b',     // slate
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  boarding: 'Boarding',
  daycare: 'Daycare',
  grooming: 'Grooming',
  both: 'Both / Multiple',
  other: 'Other',
}

const RADIUS_RINGS = [
  { miles: 5, color: '#16a34a', label: '5-mile radius' },
  { miles: 10, color: '#eab308', label: '10-mile radius' },
  { miles: 20, color: '#dc2626', label: '20-mile radius' },
]

const MILES_TO_METERS = 1609.344
const GEOCODE_BATCH_SIZE = 10
const GEOCODE_BATCH_DELAY_MS = 200

// ── Google Maps helpers ──────────────────────────────────────────────────────

let googleMapsScriptPromise: Promise<void> | null = null

async function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return
  if ((window as any).google?.maps) return
  if (googleMapsScriptPromise) return googleMapsScriptPromise

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps-sdk="true"]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps SDK.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
    script.async = true
    script.defer = true
    script.dataset.googleMapsSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps SDK.'))
    document.head.appendChild(script)
  })

  return googleMapsScriptPromise
}

async function fetchBrowserGoogleMapsKey(): Promise<string> {
  const res = await fetch('/api/competitor-analysis/map-config')
  if (!res.ok) throw new Error('Map configuration is unavailable.')
  const data = await res.json()
  if (!data?.apiKey) throw new Error('Google Maps key is unavailable for the browser map.')
  return data.apiKey as string
}

function createPinSvg(color: string, isFacility = false): string {
  if (isFacility) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="#1e293b" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="7" fill="#fff"/>
      <circle cx="16" cy="16" r="4" fill="#1e293b"/>
    </svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="34" viewBox="0 0 24 34">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 22 12 22s12-13 12-22C24 5.37 18.63 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/>
  </svg>`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClientLocationMapTab({ clientId, clientName, businessAddress }: Props) {
  // State
  const [phase, setPhase] = useState<'loading' | 'upload' | 'map'>('loading')
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [facilityAddress, setFacilityAddress] = useState(businessAddress || '')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ClientPin[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [visibleTypes, setVisibleTypes] = useState<Set<ServiceType>>(new Set(['boarding', 'daycare', 'grooming', 'both', 'other']))
  const [mapsError, setMapsError] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const circlesRef = useRef<google.maps.Circle[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load existing data ──────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/client-location-map?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
        if (!res.ok) { setPhase('upload'); return }
        const data = await res.json()
        if (data.mapData && data.mapData.clients?.length > 0) {
          setMapData(data.mapData)
          setFacilityAddress(data.mapData.facilityAddress || businessAddress || '')
          setPhase('map')
        } else {
          setPhase('upload')
        }
      } catch {
        setPhase('upload')
      }
    }
    load()
  }, [clientId, businessAddress])

  // ── Initialize map when phase changes to 'map' ─────────────────────────

  useEffect(() => {
    if (phase !== 'map' || !mapData) return
    let cancelled = false

    const initMap = async () => {
      try {
        const apiKey = await fetchBrowserGoogleMapsKey()
        await loadGoogleMapsScript(apiKey)
        if (cancelled || !mapContainerRef.current) return

        const center = mapData.facilityLat && mapData.facilityLng
          ? { lat: mapData.facilityLat, lng: mapData.facilityLng }
          : { lat: 39.8283, lng: -98.5795 }

        const map = new google.maps.Map(mapContainerRef.current, {
          center,
          zoom: 10,
          mapTypeId: 'roadmap',
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        })

        googleMapRef.current = map
        renderOverlays(map, mapData, visibleTypes)
      } catch (err: any) {
        setMapsError(err.message || 'Failed to load Google Maps')
      }
    }

    initMap()
    return () => { cancelled = true }
  }, [phase, mapData])

  // ── Re-render markers when filters change ───────────────────────────────

  useEffect(() => {
    if (phase !== 'map' || !googleMapRef.current || !mapData) return
    renderOverlays(googleMapRef.current, mapData, visibleTypes)
  }, [visibleTypes, phase, mapData])

  // ── Render overlays ─────────────────────────────────────────────────────

  const renderOverlays = useCallback((map: google.maps.Map, data: MapData, visible: Set<ServiceType>) => {
    // Clear existing
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    circlesRef.current.forEach(c => c.setMap(null))
    circlesRef.current = []

    const facilityCenter = data.facilityLat && data.facilityLng
      ? { lat: data.facilityLat, lng: data.facilityLng }
      : null

    // Draw radius rings
    if (facilityCenter) {
      RADIUS_RINGS.forEach(ring => {
        const circle = new google.maps.Circle({
          map,
          center: facilityCenter,
          radius: ring.miles * MILES_TO_METERS,
          fillColor: ring.color,
          fillOpacity: 0.04,
          strokeColor: ring.color,
          strokeWeight: 2,
          strokeOpacity: 0.5,
          clickable: false,
          draggable: false,
          editable: false,
          zIndex: 1,
        })
        circlesRef.current.push(circle)
      })

      // Facility marker
      const facilityMarker = new google.maps.Marker({
        position: facilityCenter,
        map,
        title: `${clientName} (Facility)`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(createPinSvg('#1e293b', true)),
          scaledSize: new google.maps.Size(36, 47),
          anchor: new google.maps.Point(18, 47),
        },
        zIndex: 1000,
      })
      markersRef.current.push(facilityMarker)

      const facilityInfo = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui;padding:4px 0"><strong>${clientName}</strong><br/><span style="color:#64748b;font-size:12px">${data.facilityAddress}</span><br/><span style="font-size:11px;color:#1e293b;font-weight:600">Subject Facility</span></div>`,
      })
      facilityMarker.addListener('click', () => facilityInfo.open(map, facilityMarker))
    }

    // Client markers
    const bounds = new google.maps.LatLngBounds()
    if (facilityCenter) bounds.extend(facilityCenter)

    data.clients.forEach(client => {
      if (client.geocodeStatus !== 'success' || !client.lat || !client.lng) return
      if (!visible.has(client.serviceType)) return

      const color = SERVICE_COLORS[client.serviceType] || SERVICE_COLORS.other
      const marker = new google.maps.Marker({
        position: { lat: client.lat, lng: client.lng },
        map,
        title: client.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(createPinSvg(color)),
          scaledSize: new google.maps.Size(28, 38),
          anchor: new google.maps.Point(14, 38),
        },
        zIndex: 10,
      })

      const distanceStr = facilityCenter
        ? (() => {
            const d = haversineDistance(facilityCenter.lat, facilityCenter.lng, client.lat!, client.lng!)
            return `<br/><span style="font-size:11px;color:#64748b">${d.toFixed(1)} miles from facility</span>`
          })()
        : ''

      const info = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui;padding:4px 0"><strong>${client.name}</strong><br/><span style="color:#64748b;font-size:12px">${client.address}</span><br/><span style="font-size:11px;color:${color};font-weight:600">${SERVICE_LABELS[client.serviceType]}</span>${distanceStr}</div>`,
      })
      marker.addListener('click', () => info.open(map, marker))

      markersRef.current.push(marker)
      bounds.extend({ lat: client.lat, lng: client.lng })
    })

    if (markersRef.current.length > 1) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
    }
  }, [clientName])

  // ── File handling ───────────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError('Please upload a CSV or XLSX file.')
      return
    }
    setSelectedFile(file)
    setParsedRows(null)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleUploadAndParse = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('clientId', clientId)
      formData.append('facilityAddress', facilityAddress)
      formData.append('file', selectedFile)

      const res = await fetch('/api/client-location-map', { method: 'POST', body: formData })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Upload failed')
      }
      const data = await res.json()
      const rows: ClientPin[] = data.clients.map((c: any) => ({
        name: c.name,
        address: c.address,
        serviceType: c.serviceType as ServiceType,
        geocodeStatus: 'pending' as const,
      }))
      setParsedRows(rows)
    } catch (err: any) {
      setError(err.message || 'Failed to parse file')
    } finally {
      setUploading(false)
    }
  }

  // ── Geocoding ───────────────────────────────────────────────────────────

  const startGeocoding = async () => {
    if (!parsedRows || parsedRows.length === 0) return
    setGeocoding(true)
    setError(null)

    try {
      const apiKey = await fetchBrowserGoogleMapsKey()
      await loadGoogleMapsScript(apiKey)

      const geocoder = new google.maps.Geocoder()
      const updatedClients = [...parsedRows]
      const total = updatedClients.length
      let done = 0
      setGeocodeProgress({ done: 0, total })

      // Geocode facility address first
      let facilityLat: number | undefined
      let facilityLng: number | undefined
      if (facilityAddress) {
        try {
          const facilityResult = await geocodeAddress(geocoder, facilityAddress)
          facilityLat = facilityResult.lat
          facilityLng = facilityResult.lng
        } catch {
          // Facility geocoding failed, continue without it
        }
      }

      // Batch geocode clients
      for (let i = 0; i < total; i += GEOCODE_BATCH_SIZE) {
        const batch = updatedClients.slice(i, i + GEOCODE_BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(client => geocodeAddress(geocoder, client.address))
        )

        results.forEach((result, idx) => {
          const clientIdx = i + idx
          if (result.status === 'fulfilled') {
            updatedClients[clientIdx] = {
              ...updatedClients[clientIdx],
              lat: result.value.lat,
              lng: result.value.lng,
              geocodeStatus: 'success',
            }
          } else {
            updatedClients[clientIdx] = {
              ...updatedClients[clientIdx],
              geocodeStatus: 'failed',
            }
          }
        })

        done += batch.length
        setGeocodeProgress({ done, total })

        // Rate limiting delay between batches
        if (i + GEOCODE_BATCH_SIZE < total) {
          await delay(GEOCODE_BATCH_DELAY_MS)
        }
      }

      const newMapData: MapData = {
        facilityAddress,
        facilityLat,
        facilityLng,
        clients: updatedClients,
        generatedAt: new Date().toISOString(),
      }

      setMapData(newMapData)
      setPhase('map')

      // Save to server
      setSaving(true)
      try {
        await fetch('/api/client-location-map', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, mapData: newMapData }),
        })
      } catch {
        // Non-critical, map is rendered even if save fails
      } finally {
        setSaving(false)
      }
    } catch (err: any) {
      setError(err.message || 'Geocoding failed')
    } finally {
      setGeocoding(false)
    }
  }

  // ── Export snapshot ─────────────────────────────────────────────────────

  const handleExportSnapshot = () => {
    if (!mapContainerRef.current || !googleMapRef.current) return
    const mapDiv = mapContainerRef.current

    // Use the static maps API for a clean export
    const map = googleMapRef.current
    const center = map.getCenter()
    const zoom = map.getZoom()
    if (!center) return

    // Build static map URL with markers
    const params = new URLSearchParams()
    params.set('center', `${center.lat()},${center.lng()}`)
    params.set('zoom', String(zoom || 10))
    params.set('size', '1200x800')
    params.set('maptype', 'roadmap')
    params.set('scale', '2')

    // Add facility marker
    if (mapData?.facilityLat && mapData?.facilityLng) {
      params.append('markers', `color:black|label:F|${mapData.facilityLat},${mapData.facilityLng}`)
    }

    // Group client markers by service type color
    const markerGroups: Record<string, string[]> = {}
    mapData?.clients.forEach(c => {
      if (c.geocodeStatus !== 'success' || !c.lat || !c.lng) return
      if (!visibleTypes.has(c.serviceType)) return
      const colorName = c.serviceType === 'boarding' ? 'blue'
        : c.serviceType === 'daycare' ? 'green'
        : c.serviceType === 'grooming' ? 'orange'
        : c.serviceType === 'both' ? 'purple'
        : 'gray'
      if (!markerGroups[colorName]) markerGroups[colorName] = []
      markerGroups[colorName].push(`${c.lat},${c.lng}`)
    })

    Object.entries(markerGroups).forEach(([color, positions]) => {
      // Static maps API limits markers — batch if needed
      const chunks = []
      for (let i = 0; i < positions.length; i += 50) {
        chunks.push(positions.slice(i, i + 50))
      }
      chunks.forEach(chunk => {
        params.append('markers', `color:${color}|size:small|${chunk.join('|')}`)
      })
    })

    // Open in a new tab (user can right-click Save As)
    fetchBrowserGoogleMapsKey().then(apiKey => {
      params.set('key', apiKey)
      const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
      window.open(url, '_blank')
    }).catch(() => {
      setError('Could not generate static map snapshot.')
    })
  }

  // ── Reset / Re-upload ──────────────────────────────────────────────────

  const handleReset = () => {
    setPhase('upload')
    setMapData(null)
    setSelectedFile(null)
    setParsedRows(null)
    setError(null)
    setGeocoding(false)
    setGeocodeProgress({ done: 0, total: 0 })
    // Clean up map
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    circlesRef.current.forEach(c => c.setMap(null))
    circlesRef.current = []
    googleMapRef.current = null
  }

  // ── Stats computation ──────────────────────────────────────────────────

  const stats = computeStats(mapData)

  // ── Render ─────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-3" />
        <span className="text-sm text-slate-500">Loading map data...</span>
      </div>
    )
  }

  // ── Upload Phase ────────────────────────────────────────────────────────

  if (phase === 'upload') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MapPin className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Client Location Map</h2>
            <p className="text-xs text-slate-500">Upload a CSV of client addresses to map and analyze geographic distribution</p>
          </div>
        </div>

        {/* Facility Address */}
        <Card className="p-5">
          <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
            Facility Address (center point)
          </label>
          <input
            type="text"
            value={facilityAddress}
            onChange={e => setFacilityAddress(e.target.value)}
            placeholder="e.g. 123 Main St, Anytown, TX 75001"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-white"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">This will be the center of the map with radius rings drawn around it.</p>
        </Card>

        {/* File Upload */}
        <Card className="p-5">
          <label className="block text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            Upload Client Addresses
          </label>
          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              dragActive
                ? 'border-indigo-400 bg-indigo-50/50'
                : selectedFile
                  ? 'border-indigo-300 bg-indigo-50/30'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium text-slate-700">{selectedFile.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); setSelectedFile(null); setParsedRows(null) }}
                  className="ml-2 p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Drop a CSV file here or click to browse</p>
                <p className="text-[11px] text-slate-400 mt-1.5">Expected columns: Name/Client, Address/Location, Service/Type (optional)</p>
              </>
            )}
          </div>

          {selectedFile && !parsedRows && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleUploadAndParse}
                disabled={uploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-2.5 rounded-lg flex items-center gap-2"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Parsing...' : 'Upload & Process'}
              </Button>
            </div>
          )}
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Table */}
        {parsedRows && parsedRows.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Parsed Rows</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{parsedRows.length} client addresses found</p>
              </div>
              <Button
                onClick={startGeocoding}
                disabled={geocoding || !facilityAddress}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-2.5 rounded-lg flex items-center gap-2"
              >
                {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                {geocoding ? 'Geocoding...' : 'Geocode & Map'}
              </Button>
            </div>

            {/* Geocoding progress bar */}
            {geocoding && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>Geocoding addresses...</span>
                  <span>{geocodeProgress.done} / {geocodeProgress.total}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${geocodeProgress.total > 0 ? (geocodeProgress.done / geocodeProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Address</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Service</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{row.address}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                          style={{ backgroundColor: SERVICE_COLORS[row.serviceType] }}
                        >
                          {SERVICE_LABELS[row.serviceType]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {parsedRows && parsedRows.length === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            No valid rows found. Ensure your CSV has Name and Address columns.
          </div>
        )}
      </div>
    )
  }

  // ── Map Phase ───────────────────────────────────────────────────────────

  const successCount = mapData?.clients.filter(c => c.geocodeStatus === 'success').length || 0
  const failedCount = mapData?.clients.filter(c => c.geocodeStatus === 'failed').length || 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MapPin className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Client Location Map</h2>
            <p className="text-xs text-slate-500">
              {successCount} clients mapped{failedCount > 0 ? `, ${failedCount} failed to geocode` : ''}
              {mapData?.generatedAt ? ` \u00b7 ${new Date(mapData.generatedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportSnapshot}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Export Snapshot
          </Button>
          <Button
            onClick={handleReset}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Re-upload
          </Button>
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-indigo-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving map data...
        </div>
      )}

      {mapsError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{mapsError}</span>
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {RADIUS_RINGS.map(ring => {
            const pct = stats.withinRadius[ring.miles] ?? 0
            const count = stats.countWithinRadius[ring.miles] ?? 0
            return (
              <Card key={ring.miles} className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{pct}%</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  within {ring.miles} miles
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {count} of {stats.total} clients
                </div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: ring.color }}
                  />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Map + Legend */}
      <div className="flex gap-4">
        {/* Legend panel */}
        <Card className="w-56 flex-shrink-0 p-4 self-start">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Service Types</h3>
          <div className="space-y-2">
            {(Object.keys(SERVICE_COLORS) as ServiceType[]).map(type => {
              const count = mapData?.clients.filter(c => c.serviceType === type && c.geocodeStatus === 'success').length || 0
              if (count === 0) return null
              const visible = visibleTypes.has(type)
              return (
                <button
                  key={type}
                  onClick={() => {
                    setVisibleTypes(prev => {
                      const next = new Set(prev)
                      if (next.has(type)) next.delete(type)
                      else next.add(type)
                      return next
                    })
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all text-left',
                    visible ? 'bg-slate-50 hover:bg-slate-100' : 'opacity-40 hover:opacity-60'
                  )}
                >
                  {visible ? (
                    <Eye className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  )}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: SERVICE_COLORS[type] }}
                  />
                  <span className="flex-1 text-slate-700 font-medium">{SERVICE_LABELS[type]}</span>
                  <span className="text-slate-400 font-mono text-[10px]">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Radius ring legend */}
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-5">Radius Rings</h3>
          <div className="space-y-1.5">
            {RADIUS_RINGS.map(ring => (
              <div key={ring.miles} className="flex items-center gap-2 text-[11px] text-slate-600">
                <span
                  className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                  style={{ borderColor: ring.color, backgroundColor: ring.color + '15' }}
                />
                {ring.label}
              </div>
            ))}
            <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-1">
              <span className="w-3 h-3 rounded-full bg-slate-800 flex-shrink-0" />
              Subject Facility
            </div>
          </div>
        </Card>

        {/* Map container */}
        <Card className="flex-1 overflow-hidden" style={{ minHeight: 540 }}>
          <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: 540 }} />
        </Card>
      </div>

      {/* Failed geocodes */}
      {failedCount > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            {failedCount} address{failedCount !== 1 ? 'es' : ''} could not be geocoded
          </h3>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {mapData?.clients
              .filter(c => c.geocodeStatus === 'failed')
              .map((c, idx) => (
                <div key={idx} className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="font-medium text-slate-600">{c.name}</span>
                  <span className="text-slate-400">&mdash;</span>
                  <span className="truncate">{c.address}</span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Utility functions ────────────────────────────────────────────────────────

function geocodeAddress(geocoder: google.maps.Geocoder, address: string): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location
        resolve({ lat: loc.lat(), lng: loc.lng() })
      } else {
        reject(new Error(`Geocode failed for "${address}": ${status}`))
      }
    })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function computeStats(mapData: MapData | null) {
  if (!mapData || !mapData.facilityLat || !mapData.facilityLng) return null

  const geocoded = mapData.clients.filter(c => c.geocodeStatus === 'success' && c.lat && c.lng)
  const total = geocoded.length
  if (total === 0) return null

  const withinRadius: Record<number, number> = {}
  const countWithinRadius: Record<number, number> = {}

  RADIUS_RINGS.forEach(ring => {
    const count = geocoded.filter(c =>
      haversineDistance(mapData.facilityLat!, mapData.facilityLng!, c.lat!, c.lng!) <= ring.miles
    ).length
    countWithinRadius[ring.miles] = count
    withinRadius[ring.miles] = Math.round((count / total) * 100)
  })

  return { total, withinRadius, countWithinRadius }
}
