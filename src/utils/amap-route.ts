import AMapLoader from '@amap/amap-jsapi-loader'

export interface DrivingRouteResult {
  path: [number, number][]
  distanceMeters: number
  durationSeconds: number
}

type AMapLngLatLike = { getLng: () => number; getLat: () => number } | [number, number]

function toLatLng(point: AMapLngLatLike): [number, number] {
  if (Array.isArray(point)) {
    const [lng, lat] = point
    return [lat, lng]
  }
  return [point.getLat(), point.getLng()]
}

let amapPromise: Promise<typeof AMap> | null = null

function setupSecurityConfig() {
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE
  const serviceHost = import.meta.env.VITE_AMAP_SERVICE_HOST
  if (!securityJsCode && !serviceHost) return

  window._AMapSecurityConfig = {
    ...(securityJsCode ? { securityJsCode } : {}),
    ...(serviceHost ? { serviceHost } : {}),
  }
}

async function loadAMap(): Promise<typeof AMap> {
  if (amapPromise) return amapPromise

  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) {
    throw new Error('未配置 VITE_AMAP_KEY')
  }

  setupSecurityConfig()
  amapPromise = AMapLoader.load({
    key,
    version: '2.0',
    plugins: ['AMap.Driving'],
  }) as Promise<typeof AMap>

  return amapPromise
}

/** 技师 → 服务场所：高德驾车路径 */
export async function fetchDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<DrivingRouteResult> {
  const AMapNS = await loadAMap()

  return new Promise((resolve, reject) => {
    const driving = new AMapNS.Driving({
      policy: AMapNS.DrivingPolicy.LEAST_TIME,
    })

    driving.search(
      [fromLng, fromLat],
      [toLng, toLat],
      (status, result) => {
        if (status !== 'complete' || !result || typeof result === 'string') {
          const info = typeof result === 'string' ? result : status
          reject(new Error(`驾车路径规划失败：${info || 'unknown'}`))
          return
        }

        if (!('routes' in result) || !result.routes?.length) {
          const info = 'info' in result && typeof result.info === 'string' ? result.info : status
          reject(new Error(`驾车路径规划失败：${info || 'unknown'}`))
          return
        }

        const route = result.routes[0]
        const path: [number, number][] = []

        for (const step of route.steps || []) {
          const stepPath = step.path || []
          for (const point of stepPath) {
            path.push(toLatLng(point as AMapLngLatLike))
          }
        }

        if (path.length < 2) {
          path.push([fromLat, fromLng], [toLat, toLng])
        }

        resolve({
          path,
          distanceMeters: Number(route.distance) || 0,
          durationSeconds: Number(route.time) || 0,
        })
      },
    )
  })
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}
