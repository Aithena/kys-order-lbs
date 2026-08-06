/** 球面距离（米） */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} 米`
  return `${(meters / 1000).toFixed(2)} 公里`
}

export function midLatLng(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): [number, number] {
  return [(lat1 + lat2) / 2, (lng1 + lng2) / 2]
}

/** 在折线路径上按比例取点（0~1） */
export function pointAlongPath(
  path: Array<[number, number]>,
  ratio: number,
): [number, number] {
  if (path.length === 0) return [0, 0]
  if (path.length === 1) return path[0]

  const t = Math.min(1, Math.max(0, ratio))
  let total = 0
  const segLens: number[] = []
  for (let i = 1; i < path.length; i++) {
    const len = haversineMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
    segLens.push(len)
    total += len
  }
  if (total <= 0) return path[Math.floor((path.length - 1) * t)]

  let remain = total * t
  for (let i = 0; i < segLens.length; i++) {
    const seg = segLens[i]
    if (remain <= seg || i === segLens.length - 1) {
      const localT = seg > 0 ? remain / seg : 0
      const [lat1, lng1] = path[i]
      const [lat2, lng2] = path[i + 1]
      return [lat1 + (lat2 - lat1) * localT, lng1 + (lng2 - lng1) * localT]
    }
    remain -= seg
  }
  return path[path.length - 1]
}

/** 沿线段法线方向做小幅偏移，避免标签重叠 */
export function offsetAlongNormal(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  atLat: number,
  atLng: number,
  meters: number,
): [number, number] {
  const dLat = lat2 - lat1
  const dLng = lng2 - lng1
  const len = Math.hypot(dLat, dLng) || 1
  // 近似：纬度 1° ≈ 111320m，经度随纬度变化
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos((atLat * Math.PI) / 180)
  const nLat = (-dLng / len) * (meters / metersPerDegLat)
  const nLng = (dLat / len) * (meters / Math.max(metersPerDegLng, 1e-6))
  return [atLat + nLat, atLng + nLng]
}
