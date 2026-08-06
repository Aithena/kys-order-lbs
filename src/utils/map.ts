import L from 'leaflet'
import type { MarkerRole } from '../types'

const ROLE_COLOR: Record<MarkerRole, string> = {
  technician: '#1677ff',
  customer: '#f5222d',
  venue: '#52c41a',
}

export function createRoleIcon(role: MarkerRole, title: string): L.DivIcon {
  const color = ROLE_COLOR[role]
  return L.divIcon({
    className: 'lbs-marker',
    html: `
      <div class="lbs-marker-wrap">
        <div class="lbs-marker-label" style="border-color:${color};color:${color}">${title}</div>
        <svg width="24" height="32" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.716 23.284 0 15 0z" fill="${color}"/>
          <circle cx="15" cy="14" r="6" fill="#fff"/>
        </svg>
      </div>
    `,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -32],
  })
}

/** 与 kys-therapist-map 相同的高德瓦片源 */
export function createAmapTileLayer(): L.TileLayer {
  return L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '&copy; 高德地图',
    },
  )
}

export const DEFAULT_CENTER: L.LatLngExpression = [28.217519, 113.099411]
export const DEFAULT_ZOOM = 13
