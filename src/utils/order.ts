import type { MapPoint, OrderLbsPayload } from '../types'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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

  const payload = data as Partial<OrderLbsPayload>
  const address = payload.address

  if (!isFiniteNumber(payload.technicianLatitude) || !isFiniteNumber(payload.technicianLongitude)) {
    throw new Error('缺少技师经纬度：technicianLatitude / technicianLongitude')
  }
  if (!isFiniteNumber(payload.customerLatitude) || !isFiniteNumber(payload.customerLongitude)) {
    throw new Error('缺少客户经纬度：customerLatitude / customerLongitude')
  }
  if (!address || !isFiniteNumber(address.lat) || !isFiniteNumber(address.lng)) {
    throw new Error('缺少服务场所经纬度：address.lat / address.lng')
  }

  return payload as OrderLbsPayload
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
