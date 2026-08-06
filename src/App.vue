<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import { createAmapTileLayer, createRoleIcon, DEFAULT_CENTER, DEFAULT_ZOOM } from './utils/map'
import { parseOrderPayload, toMapPoints } from './utils/order'

const SAMPLE_JSON = ``

const mapEl = ref<HTMLElement | null>(null)
const dialogVisible = ref(false)
const jsonText = ref(SAMPLE_JSON)
const submitting = ref(false)

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

function markPoints() {
  if (!map || !markerGroup) return

  submitting.value = true
  try {
    const payload = parseOrderPayload(jsonText.value.trim())
    const points = toMapPoints(payload)

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

    const bounds = markerGroup.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.25))
    }

    dialogVisible.value = false
    ElMessage.success('已在地图上标记 3 个点位')
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
</style>
