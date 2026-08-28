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
import { formatDistance, haversineMeters, pointAlongPath } from './utils/geo'
import { fetchDrivingRoute, formatDuration } from './utils/amap-route'
import { parseOrderPayload, toMapPoints, toOrderInfo } from './utils/order'
import type { OrderInfoView } from './types'

const SAMPLE_JSON = ``

const mapEl = ref<HTMLElement | null>(null)
const dialogVisible = ref(false)
const jsonText = ref(SAMPLE_JSON)
const submitting = ref(false)
const routeSummary = ref<{
  travelDistance: string
  travelMode: string
  travelDuration?: string
  customerStraightDistance?: string
} | null>(null)
const orderInfo = ref<OrderInfoView | null>(null)

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
    if (!technician || !venue) {
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
      const detail = routeErr instanceof Error ? routeErr.message : '未知错误'
      ElMessage.warning(`驾车路径规划失败，已改用直线距离（${detail}）`)
    }

    const travelText = formatDistance(travelMeters)
    const travelTitle = travelMode === '驾车' ? '驾车距离' : '出行距离'
    const travelPopup = [
      '技师 → 服务场所',
      `${travelTitle}：${travelText}`,
      travelDuration ? `预计耗时：${travelDuration}` : '',
    ]
      .filter(Boolean)
      .join('<br/>')

    const travelLatLngs = travelPath.map((p) => {
      if (Array.isArray(p)) return [p[0], p[1]] as [number, number]
      const ll = L.latLng(p)
      return [ll.lat, ll.lng] as [number, number]
    })

    markerGroup.addLayer(
      L.polyline(travelLatLngs, {
        color: '#1677ff',
        weight: 4,
        opacity: 0.85,
      }).bindPopup(travelPopup),
    )

    // 驾车标签压在路径上（约 35% 处，避开与直线标签重叠）
    const travelLabelAt = pointAlongPath(travelLatLngs, 0.35)
    markerGroup.addLayer(
      L.marker(travelLabelAt, {
        icon: createDistanceLabel(travelTitle, travelText, 'driving'),
        interactive: false,
        keyboard: false,
        zIndexOffset: 600,
      }),
    )

    let customerText: string | undefined
    if (customer) {
      // 客户 → 服务场所：直线距离
      const customerMeters = haversineMeters(
        customer.lat,
        customer.lng,
        venue.lat,
        venue.lng,
      )
      customerText = formatDistance(customerMeters)
      const straightPath: Array<[number, number]> = [
        [customer.lat, customer.lng],
        [venue.lat, venue.lng],
      ]
      markerGroup.addLayer(
        L.polyline(straightPath, {
          color: '#fa8c16',
          weight: 3,
          opacity: 0.9,
          dashArray: '10 8',
        }).bindPopup(`客户 → 服务场所<br/>直线距离：${customerText}`),
      )

      // 直线标签压在虚线中点上
      const straightLabelAt = pointAlongPath(straightPath, 0.5)
      markerGroup.addLayer(
        L.marker(straightLabelAt, {
          icon: createDistanceLabel('直线距离', customerText, 'straight'),
          interactive: false,
          keyboard: false,
          zIndexOffset: 500,
        }),
      )
    }

    routeSummary.value = {
      travelDistance: travelText,
      travelMode,
      travelDuration: travelDuration || undefined,
      customerStraightDistance: customerText,
    }
    orderInfo.value = toOrderInfo(payload)

    const bounds = markerGroup.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.25))
    }

    dialogVisible.value = false
    ElMessage.success(customer ? '已标记点位并绘制路径距离' : '已标记技师与服务场所（无客户位置）')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '标记失败')
  } finally {
    submitting.value = false
  }
}

function openDialog() {
  dialogVisible.value = true
}

function formatJsonText() {
  const raw = jsonText.value.trim()
  if (!raw) {
    ElMessage.warning('请先输入 JSON')
    return
  }

  try {
    const parsed = JSON.parse(raw)
    jsonText.value = JSON.stringify(parsed, null, 2)
  } catch {
    ElMessage.error('JSON 格式无效，请检查后重试')
  }
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

    <div v-if="orderInfo" class="float-panel order-info">
      <div class="panel-title">
        <span>订单信息</span>
        <span v-if="orderInfo.serviceMode" class="mode-tag">{{ orderInfo.serviceMode }}</span>
      </div>

      <div v-for="(item, idx) in orderInfo.goods" :key="idx" class="goods-card">
        <img
          v-if="item.cover"
          class="goods-card__cover"
          :src="item.cover"
          alt=""
          @error="item.cover = undefined"
        />
        <div class="goods-card__body">
          <div class="goods-card__title">{{ item.title }}</div>
          <div v-if="item.meta" class="goods-card__meta">{{ item.meta }}</div>
          <div v-if="item.fee" class="goods-card__fee">{{ item.fee }}</div>
        </div>
      </div>

      <div class="order-rows">
        <div v-for="row in orderInfo.rows" :key="row.label" class="order-row">
          <span class="order-row__label">{{ row.label }}</span>
          <span class="order-row__value">{{ row.value }}</span>
        </div>
      </div>
    </div>

    <div v-if="routeSummary" class="float-panel summary">
      <div class="panel-title">距离信息</div>
      <div class="summary-card travel">
        <div class="summary-card__head">
          <span class="line-sample solid" />
          <span>技师 → 服务场所</span>
          <span class="tag">{{ routeSummary.travelMode }}</span>
        </div>
        <div class="summary-card__value">{{ routeSummary.travelDistance }}</div>
        <div v-if="routeSummary.travelDuration" class="summary-card__meta">
          预计耗时 {{ routeSummary.travelDuration }}
        </div>
      </div>
      <div v-if="routeSummary.customerStraightDistance" class="summary-card customer">
        <div class="summary-card__head">
          <span class="line-sample dashed" />
          <span>客户 → 服务场所</span>
          <span class="tag">直线</span>
        </div>
        <div class="summary-card__value">{{ routeSummary.customerStraightDistance }}</div>
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
        :autosize="{ minRows: 12, maxRows: 20 }"
        resize="vertical"
        placeholder="请粘贴订单 JSON，需包含技师/address 经纬度；客户经纬度可为空"
        class="json-textarea"
      />
      <template #footer>
        <div class="json-dialog-footer">
          <el-button @click="formatJsonText">格式化</el-button>
          <span>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="markPoints">
              确定
            </el-button>
          </span>
        </div>
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

  .float-panel {
    position: absolute;
    z-index: 1000;
    width: 260px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.96);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    font-size: 13px;
    color: #333;
  }

  .panel-title {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    font-weight: 600;
    font-size: 14px;
  }

  .mode-tag {
    margin-left: auto;
    padding: 0 8px;
    border-radius: 999px;
    background: #f0f5ff;
    color: #1677ff;
    font-size: 11px;
    font-weight: 500;
  }

  .order-info {
    top: 16px;
    left: 16px;
    max-height: calc(100% - 252px);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  .goods-card {
    display: flex;
    gap: 10px;
    padding: 8px;
    border-radius: 8px;
    background: #f7f8fa;

    & + .goods-card,
    & + .order-rows {
      margin-top: 8px;
    }

    .goods-card__cover {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      object-fit: cover;
      flex-shrink: 0;
      background: #eee;
    }

    .goods-card__body {
      min-width: 0;
      flex: 1;
    }

    .goods-card__title {
      font-weight: 600;
      line-height: 1.3;
      word-break: break-word;
    }

    .goods-card__meta {
      margin-top: 2px;
      color: #8c8c8c;
      font-size: 12px;
    }

    .goods-card__fee {
      margin-top: 2px;
      color: #cf1322;
      font-weight: 600;
    }
  }

  .order-rows {
    margin-top: 8px;

    .order-row {
      display: flex;
      gap: 8px;
      padding: 7px 0;
      border-bottom: 1px solid #f0f0f0;
      line-height: 1.4;

      &:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }
    }

    .order-row__label {
      flex: 0 0 56px;
      color: #8c8c8c;
      font-size: 12px;
    }

    .order-row__value {
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }
  }

  .summary {
    left: 16px;
    bottom: 24px;

    .summary-card {
      padding: 10px 12px;
      border-radius: 8px;
      background: #f7f8fa;

      & + .summary-card {
        margin-top: 8px;
      }

      &.travel {
        border-left: 3px solid #1677ff;
      }

      &.customer {
        border-left: 3px solid #fa8c16;
      }

      .summary-card__head {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #666;
        font-size: 12px;
      }

      .summary-card__value {
        margin-top: 4px;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
        color: #1f1f1f;
      }

      .summary-card__meta {
        margin-top: 4px;
        color: #8c8c8c;
        font-size: 12px;
      }

      .tag {
        margin-left: auto;
        padding: 0 6px;
        border-radius: 999px;
        background: #fff;
        color: #8c8c8c;
        font-size: 11px;
      }

      .line-sample {
        width: 16px;
        height: 0;
        border-top: 3px solid currentColor;
        flex-shrink: 0;

        &.solid {
          color: #1677ff;
        }

        &.dashed {
          color: #fa8c16;
          border-top-style: dashed;
        }
      }
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
  background: transparent !important;
  border: none !important;
  overflow: visible !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

:deep(.lbs-distance-chip) {
  display: inline-block;
  box-sizing: border-box;
  width: max-content;
  max-width: none;
  margin: 0;
  padding: 5px;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid transparent;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  font-size: 10px;
  line-height: 1.1;
  text-align: center;

  .lbs-distance-chip__title,
  .lbs-distance-chip__value {
    display: block;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.1;
  }

  &--driving {
    border-color: #1677ff;
    color: #1677ff;
  }

  &--straight {
    border-color: #fa8c16;
    color: #fa8c16;
  }
}

.json-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

:deep(.json-textarea .el-textarea__inner) {
  font-size: 12px;
  line-height: 1.6;
  font-family: Consolas, Monaco, monospace;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-all;
}

</style>
