import type { MapPoint, OrderLbsPayload } from '../types'

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function parseOrderPayload(raw: string): OrderLbsPayload {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('JSON 格式无效，请检查后重试')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('请输入有效的订单 JSON 对象')
  }

  const payload = data as Record<string, unknown>
  const addressRaw = payload.address
  if (!addressRaw || typeof addressRaw !== 'object') {
    throw new Error('缺少服务场所经纬度：address.lat / address.lng')
  }
  const address = addressRaw as Record<string, unknown>

  const technicianLatitude = toFiniteNumber(payload.technicianLatitude)
  const technicianLongitude = toFiniteNumber(payload.technicianLongitude)
  const customerLatitude = toFiniteNumber(payload.customerLatitude)
  const customerLongitude = toFiniteNumber(payload.customerLongitude)
  const venueLat = toFiniteNumber(address.lat)
  const venueLng = toFiniteNumber(address.lng)

  if (technicianLatitude == null || technicianLongitude == null) {
    throw new Error('缺少技师经纬度：technicianLatitude / technicianLongitude')
  }
  if (customerLatitude == null || customerLongitude == null) {
    throw new Error('缺少客户经纬度：customerLatitude / customerLongitude')
  }
  if (venueLat == null || venueLng == null) {
    throw new Error('缺少服务场所经纬度：address.lat / address.lng')
  }

  return {
    ...(payload as unknown as OrderLbsPayload),
    technicianLatitude,
    technicianLongitude,
    customerLatitude,
    customerLongitude,
    address: {
      ...(address as unknown as OrderLbsPayload['address']),
      lat: venueLat,
      lng: venueLng,
    },
  }
}

export function toMapPoints(payload: OrderLbsPayload): MapPoint[] {
  const venueAddress = [payload.address.regionName, payload.address.address]
    .filter(Boolean)
    .join(' ')

  return [
    {
      role: 'technician',
      label: '技师位置',
      lat: payload.technicianLatitude,
      lng: payload.technicianLongitude,
      detail: [payload.technicianName, payload.technicianPhone].filter(Boolean).join(' · '),
    },
    {
      role: 'customer',
      label: '客户位置',
      lat: payload.customerLatitude,
      lng: payload.customerLongitude,
      detail: [payload.address.fullName, payload.address.phone].filter(Boolean).join(' · '),
    },
    {
      role: 'venue',
      label: '服务场所',
      lat: payload.address.lat,
      lng: payload.address.lng,
      detail: venueAddress || [payload.schoolName, payload.merchantName].filter(Boolean).join(' · '),
    },
  ]
}
