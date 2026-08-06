import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'
import './style.less'

// 必须在加载高德 JSAPI 之前设置安全密钥
const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim()
if (securityJsCode) {
  window._AMapSecurityConfig = { securityJsCode }
}

createApp(App).use(ElementPlus).mount('#app')
