/** 订单 LBS 输入 JSON 结构（仅保留地图标注所需字段） */
export interface OrderAddress {
  lat: number
  lng: number
  address?: string
  regionName?: string
  fullName?: string
  phone?: string
}

export interface OrderGoods {
  goodsType?: number
  goodsId?: number
  goodsTitle?: string
  goodsGroupName?: string
  cover?: string
  duration?: number
  fee?: number
  dashFee?: number
  quantity?: number
}

export interface OrderLbsPayload {
  technicianName?: string
  technicianPhone?: string
  technicianLatitude: number
  technicianLongitude: number
  customerLatitude?: number | null
  customerLongitude?: number | null
  merchantName?: string
  schoolName?: string
  arrivalTime?: string
  buyMessage?: string
  storeId?: number
  storeName?: string
  tripFee?: number
  soureDetail?: string
  goodss?: OrderGoods[]
  address: OrderAddress
}

export interface OrderGoodsView {
  title: string
  cover?: string
  meta?: string
  fee?: string
}

export interface OrderInfoRow {
  label: string
  value: string
}

export interface OrderInfoView {
  serviceMode?: string
  goods: OrderGoodsView[]
  rows: OrderInfoRow[]
}

export type MarkerRole = 'technician' | 'customer' | 'venue'

export interface MapPoint {
  role: MarkerRole
  label: string
  lat: number
  lng: number
  detail?: string
}
