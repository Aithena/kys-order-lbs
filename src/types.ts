/** 订单 LBS 输入 JSON 结构（仅保留地图标注所需字段） */
export interface OrderAddress {
  lat: number
  lng: number
  address?: string
  regionName?: string
  fullName?: string
  phone?: string
}

export interface OrderLbsPayload {
  technicianName?: string
  technicianPhone?: string
  technicianLatitude: number
  technicianLongitude: number
  customerLatitude: number
  customerLongitude: number
  merchantName?: string
  schoolName?: string
  arrivalTime?: string
  address: OrderAddress
}

export type MarkerRole = 'technician' | 'customer' | 'venue'

export interface MapPoint {
  role: MarkerRole
  label: string
  lat: number
  lng: number
  detail?: string
}
