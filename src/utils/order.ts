import type { MapPoint, OrderGoods, OrderInfoView, OrderLbsPayload } from '../types'

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
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
  if (venueLat == null || venueLng == null) {
    throw new Error('缺少服务场所经纬度：address.lat / address.lng')
  }

  // 客户经纬度允许 null；只传一侧时视为无效，不展示客户点
  const hasCustomer =
    customerLatitude != null && customerLongitude != null

  return {
    ...(payload as unknown as OrderLbsPayload),
    technicianLatitude,
    technicianLongitude,
    customerLatitude: hasCustomer ? customerLatitude : null,
    customerLongitude: hasCustomer ? customerLongitude : null,
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

  const points: MapPoint[] = [
    {
      role: 'technician',
      label: '技师位置',
      lat: payload.technicianLatitude,
      lng: payload.technicianLongitude,
      detail: [payload.technicianName, payload.technicianPhone].filter(Boolean).join(' · '),
    },
    {
      role: 'venue',
      label: '服务场所',
      lat: payload.address.lat,
      lng: payload.address.lng,
      detail: venueAddress || [payload.schoolName, payload.merchantName].filter(Boolean).join(' · '),
    },
  ]

  if (payload.customerLatitude != null && payload.customerLongitude != null) {
    points.splice(1, 0, {
      role: 'customer',
      label: '客户位置',
      lat: payload.customerLatitude,
      lng: payload.customerLongitude,
      detail: [payload.address.fullName, payload.address.phone].filter(Boolean).join(' · '),
    })
  }

  return points
}

function formatFeeFen(fen: number): string {
  const yuan = fen / 100
  return yuan % 1 === 0 ? `¥${yuan}` : `¥${yuan.toFixed(2)}`
}

function parseSourcePage(detail: unknown): string | undefined {
  if (detail == null || detail === '') return undefined
  let obj: unknown = detail
  if (typeof detail === 'string') {
    try {
      obj = JSON.parse(detail)
    } catch {
      return detail.trim() || undefined
    }
  }
  if (obj && typeof obj === 'object' && 'pageName' in obj) {
    const name = (obj as { pageName?: unknown }).pageName
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return undefined
}

function toGoodsView(item: OrderGoods) {
  const title = item.goodsTitle?.trim() || '未命名项目'
  const metaParts = [
    item.goodsGroupName?.trim(),
    item.duration != null && Number.isFinite(item.duration) ? `${item.duration}分钟` : '',
    item.quantity != null && item.quantity > 1 ? `×${item.quantity}` : '',
  ].filter(Boolean)

  return {
    title,
    cover: item.cover?.trim() || undefined,
    meta: metaParts.join(' · ') || undefined,
    fee:
      item.fee != null && Number.isFinite(item.fee) ? formatFeeFen(item.fee) : undefined,
  }
}

export function toOrderInfo(payload: OrderLbsPayload): OrderInfoView {
  const storeName = payload.storeName?.trim()
  const fullName = payload.address.fullName?.trim()
  const phone = payload.address.phone?.trim()
  const rows: OrderInfoView['rows'] = []

  if (payload.arrivalTime?.trim()) {
    rows.push({ label: '预约时间', value: payload.arrivalTime.trim() })
  }

  const technician = [payload.technicianName, payload.technicianPhone]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' · ')
  if (technician) rows.push({ label: '技师', value: technician })

  if (payload.merchantName?.trim()) {
    rows.push({ label: '商家', value: payload.merchantName.trim() })
  }
  if (payload.schoolName?.trim()) {
    rows.push({ label: '医派', value: payload.schoolName.trim() })
  }
  if (storeName) rows.push({ label: '门店', value: storeName })

  const addressText = [payload.address.regionName, payload.address.address]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' ')
  if (addressText) rows.push({ label: '地址', value: addressText })

  if (fullName && fullName !== storeName) {
    rows.push({
      label: '客户',
      value: [fullName, phone].filter(Boolean).join(' · '),
    })
  } else if (phone) {
    rows.push({ label: storeName ? '门店电话' : '联系电话', value: phone })
  }

  if (payload.tripFee != null && payload.tripFee > 0) {
    rows.push({ label: '车费', value: formatFeeFen(payload.tripFee) })
  }
  if (payload.buyMessage?.trim()) {
    rows.push({ label: '备注', value: payload.buyMessage.trim() })
  }

  const source = parseSourcePage(payload.soureDetail)
  if (source) rows.push({ label: '来源', value: source })

  return {
    serviceMode: storeName ? '到店' : '上门',
    goods: (payload.goodss ?? []).map(toGoodsView),
    rows,
  }
}
