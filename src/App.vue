<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import {
  createAmapTileLayer,
  createDistanceLabel,
  createRoleIcon,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
} from './utils/map'
import { formatDistance, haversineMeters, midLatLng } from './utils/geo'
import { fetchDrivingRoute, formatDuration } from './utils/amap-route'
import { parseOrderPayload, toMapPoints } from './utils/order'

const SAMPLE_JSON = ``

const mapEl = ref<HTMLElement | null>(null)
const dialogVisible = ref(false)
const jsonText = ref(SAMPLE_JSON)
const submitting = ref(false)
const routeSummary = ref<{
  travelDistance: string
  travelMode: string
  travelDuration?: string
  customerStraightDistance: string
} | null>(null)

let map: L.Map | null = null
let markerGroup: L.FeatureGroup | null = null

function initMap() {
  if (!mapEl.value || map) return

  map = L.map(mapEl.value, {
    zoomControl: false,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

  L.control.zoom({ position: 'bottomright' }).addTo(map)
  createAmapTileLayer().addTo(map)
  markerGroup = L.featureGroup().addTo(map)

  // 修复容器尺寸未就绪时瓦片错位
  requestAnimationFrame(() => map?.invalidateSize())
}

function clearMarkers() {
  markerGroup?.clearLayers()
}

async function markPoints() {
  if (!map || !markerGroup) return

  submitting.value = true
  try {
    const payload = parseOrderPayload(jsonText.value.trim())
    const points = toMapPoints(payload)
    const technician = points.find((p) => p.role === 'technician')
    const customer = points.find((p) => p.role === 'customer')
    const venue = points.find((p) => p.role === 'venue')
    if (!technician || !customer || !venue) {
      throw new Error('点位数据不完整')
    }

    clearMarkers()

    for (const point of points) {
      const marker = L.marker([point.lat, point.lng], {
        icon: createRoleIcon(point.role, point.label),
        title: point.label,
      })

      const lines = [
        `<strong>${point.label}</strong>`,
        point.detail ? `<div>${point.detail}</div>` : '',
        `<div style="color:#888;margin-top:4px">${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</div>`,
      ]
      marker.bindPopup(lines.filter(Boolean).join(''))
      markerGroup.addLayer(marker)
    }

    // 技师 → 服务场所：优先高德驾车路径，失败则回退直线
    let travelPath: L.LatLngExpression[] = [
      [technician.lat, technician.lng],
      [venue.lat, venue.lng],
    ]
    let travelMeters = haversineMeters(
      technician.lat,
      technician.lng,
      venue.lat,
      venue.lng,
    )
    let travelMode = '直线'
    let travelDuration = ''

    try {
      const driving = await fetchDrivingRoute(
        technician.lat,
        technician.lng,
        venue.lat,
        venue.lng,
      )
      travelPath = driving.path
      travelMeters = driving.distanceMeters || travelMeters
      travelMode = '驾车'
      travelDuration = formatDuration(driving.durationSeconds)
    } catch (routeErr) {
      console.warn('高德驾车规划失败，回退直线距离', routeErr)
      ElMessage.warning('驾车路径规划失败，已改用直线距离')
    }

    const travelText = formatDistance(travelMeters)
    const travelPopup = [
      '技师 → 服务场所',
      `出行距离（${travelMode}）：${travelText}`,
      travelDuration ? `预计耗时：${travelDuration}` : '',
    ]
      .filter(Boolean)
      .join('<br/>')

    markerGroup.addLayer(
      L.polyline(travelPath, {
        color: '#1677ff',
        weight: 4,
        opacity: 0.85,
      }).bindPopup(travelPopup),
    )

    const travelLabelAt =
      travelPath.length >= 2
        ? (travelPath[Math.floor(travelPath.length / 2)] as [number, number])
        : midLatLng(technician.lat, technician.lng, venue.lat, venue.lng)

    markerGroup.addLayer(
      L.marker(travelLabelAt, {
        icon: createDistanceLabel(`${travelMode} ${travelText}`, '#1677ff'),
        interactive: false,
        keyboard: false,
      }),
    )

    // 客户 → 服务场所：直线距离
    const customerMeters = haversineMeters(
      customer.lat,
      customer.lng,
      venue.lat,
      venue.lng,
    )
    const customerText = formatDistance(customerMeters)
    markerGroup.addLayer(
      L.polyline(
        [
          [customer.lat, customer.lng],
          [venue.lat, venue.lng],
        ],
        {
          color: '#fa8c16',
          weight: 3,
          opacity: 0.9,
          dashArray: '10 8',
        },
      ).bindPopup(`客户 → 服务场所<br/>直线距离：${customerText}`),
    )
    markerGroup.addLayer(
      L.marker(midLatLng(customer.lat, customer.lng, venue.lat, venue.lng), {
        icon: createDistanceLabel(`直线 ${customerText}`, '#fa8c16'),
        interactive: false,
        keyboard: false,
      }),
    )

    routeSummary.value = {
      travelDistance: travelText,
      travelMode,
      travelDuration: travelDuration || undefined,
      customerStraightDistance: customerText,
    }

    const bounds = markerGroup.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.25))
    }

    dialogVisible.value = false
    ElMessage.success('已标记点位并绘制路径距离')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '标记失败')
  } finally {
    submitting.value = false
  }
}

function openDialog() {
  dialogVisible.value = true
}

onMounted(async () => {
  await nextTick()
  initMap()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  markerGroup = null
})
</script>

<template>
  <div class="page">
    <div ref="mapEl" class="map" />

    <div class="toolbar">
      <el-button type="primary" size="large" @click="openDialog">
        导入订单日志
      </el-button>
    </div>

    <div v-if="routeSummary" class="summary">
      <div class="summary-title">距离信息</div>
      <div class="summary-row">
        <span class="dot travel" />
        技师 → 服务场所：{{ routeSummary.travelDistance }}
        <span class="hint">{{ routeSummary.travelMode }}</span>
      </div>
      <div v-if="routeSummary.travelDuration" class="summary-row sub">
        预计耗时：{{ routeSummary.travelDuration }}
      </div>
      <div class="summary-row">
        <span class="dot customer" />
        客户 → 服务场所：{{ routeSummary.customerStraightDistance }}
        <span class="hint">直线</span>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="粘贴订单 JSON"
      width="720px"
      destroy-on-close
      append-to-body
      :close-on-click-modal="false"
    >
      <el-input
        v-model="jsonText"
        type="textarea"
        :rows="16"
        :autosize="{ minRows: 12, maxRows: 28 }"
        resize="vertical"
        placeholder="请粘贴订单 JSON，需包含技师/客户/address 经纬度（不限制长度）"
      />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="markPoints">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="less">
.page {
  position: relative;
  width: 100%;
  height: 100%;

  .map {
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  .toolbar {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 1000;
  }

  .summary {
    position: absolute;
    left: 16px;
    bottom: 24px;
    z-index: 1000;
    min-width: 240px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    font-size: 13px;
    line-height: 1.6;
    color: #333;

    .summary-title {
      margin-bottom: 6px;
      font-weight: 600;
    }

    .summary-row {
      display: flex;
      align-items: center;
      gap: 6px;

      &.sub {
        padding-left: 16px;
        color: #666;
        font-size: 12px;
      }
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;

      &.travel {
        background: #1677ff;
      }

      &.customer {
        background: #fa8c16;
      }
    }

    .hint {
      margin-left: auto;
      color: #999;
      font-size: 12px;
    }
  }
}

:deep(.lbs-marker) {
  background: transparent;
  border: none;
}

:deep(.lbs-marker-wrap) {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateY(-4px);
}

:deep(.lbs-marker-label) {
  margin-bottom: 2px;
  padding: 2px 6px;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 600;
  background: #fff;
  border: 1px solid;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

:deep(.lbs-distance) {
  background: transparent;
  border: none;
}

:deep(.lbs-distance-label) {
  transform: translate(-50%, -50%);
  padding: 2px 8px;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid;
  border-radius: 999px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
</style>
