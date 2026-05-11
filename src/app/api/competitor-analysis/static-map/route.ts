import { NextRequest } from 'next/server';

const GOOGLE_STATIC_MAPS_URL = 'https://maps.googleapis.com/maps/api/staticmap';
export const dynamic = 'force-dynamic';

function parseCoordinate(value: string | null, label: string) {
  if (!value) {
    throw new Error(`Missing ${label} coordinates.`);
  }
  const [latRaw, lngRaw] = value.split(',');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Invalid ${label} coordinates.`);
  }
  return { lat, lng };
}

function buildCirclePath(center: { lat: number; lng: number }, radiusMiles: number) {
  const points: string[] = [];
  const earthRadiusMiles = 3958.8;
  const angularDistance = radiusMiles / earthRadiusMiles;
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;

  for (let step = 0; step <= 24; step++) {
    const bearing = (2 * Math.PI * step) / 24;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    points.push(`${(lat2 * 180) / Math.PI},${(lng2 * 180) / Math.PI}`);
  }

  return `color:0xb8922aaa|weight:2|fillcolor:0xb8922a22|${points.join('|')}`;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_SERVICES_API;
  if (!apiKey) {
    return new Response('Map service is not configured.', { status: 500 });
  }

  try {
    const center = parseCoordinate(req.nextUrl.searchParams.get('center'), 'center');
    const subject = parseCoordinate(req.nextUrl.searchParams.get('subject'), 'subject');
    const radiusMiles = Number(req.nextUrl.searchParams.get('radius') ?? '5');
    const points = (req.nextUrl.searchParams.get('points') ?? '')
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 80);

    const params = new URLSearchParams({
      key: apiKey,
      size: '1200x720',
      scale: '2',
      maptype: 'roadmap',
    });

    params.append('style', 'feature:poi|visibility:off');
    params.append('style', 'feature:transit|visibility:off');
    params.append('style', 'feature:road|element:geometry|color:0xf5f5f5');
    params.append('style', 'feature:water|color:0xdbeafe');
    params.append('style', 'feature:landscape|color:0xf8fafc');
    params.append('path', buildCirclePath(center, radiusMiles));
    params.append('markers', `color:0x1f2937|label:S|${subject.lat},${subject.lng}`);

    for (const point of points) {
      const [latRaw, lngRaw, labelRaw] = point.split(',');
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      const label = (labelRaw ?? '').slice(0, 1).toUpperCase() || '1';
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      params.append('markers', `color:0xb8922a|label:${label}|${lat},${lng}`);
    }

    const mapRes = await fetch(`${GOOGLE_STATIC_MAPS_URL}?${params.toString()}`);
    if (!mapRes.ok) {
      throw new Error(`Static map failed (${mapRes.status})`);
    }

    const contentType = mapRes.headers.get('content-type') ?? 'image/png';
    return new Response(await mapRes.arrayBuffer(), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Competitor Analysis] Static map error:', error);
    return new Response('Unable to render the market map.', { status: 400 });
  }
}
