<template>
  <div :class="['capture-workspace', currentTheme]">
    <!-- 1. 顶部控制栏 & 统计数据 -->
    <header class="top-bar">
      <div class="brand">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">Network Proxy Console</span>
      </div>

      <!-- 快速统计 -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">Total:</span>
          <span class="stat-value">{{ captureList.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Success:</span>
          <span class="stat-value success">{{ successCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Errors:</span>
          <span class="stat-value error">{{ errorCount }}</span>
        </div>
      </div>

      <div class="actions">
        <el-tooltip :content="currentTheme === 'dark' ? '切换至亮色模式' : '切换至暗黑模式'" placement="bottom">
          <el-button
              circle
              :icon="currentTheme === 'dark' ? Sunny : Moon"
              @click="toggleTheme"
          />
        </el-tooltip>

        <el-button
            :type="isCapturing ? 'danger' : 'success'"
            :icon="isCapturing ? VideoPause : VideoPlay"
            @click="toggleCapture"
        >
          {{ isCapturing ? '暂停捕获' : '开启捕获' }}
        </el-button>

        <el-button :icon="Delete" @click="clearLogs">清空日志</el-button>
      </div>
    </header>

    <!-- 2. 二级筛选工具栏 -->
    <div class="filter-bar">
      <el-select v-model="filterMethod" placeholder="Method" clearable style="width: 120px;">
        <el-option label="GET" value="GET" />
        <el-option label="POST" value="POST" />
        <el-option label="PUT" value="PUT" />
        <el-option label="DELETE" value="DELETE" />
      </el-select>

      <el-select v-model="filterStatus" placeholder="Status" clearable style="width: 140px;">
        <el-option label="2xx Success" value="2xx" />
        <el-option label="4xx / 5xx Error" value="err" />
      </el-select>

      <el-input
          v-model="filterText"
          placeholder="搜索 URL / 请求体 / 响应体 / IP..."
          clearable
          class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <span class="filter-count">显示 {{ filteredList.length }} / {{ captureList.length }} 条</span>
    </div>

    <!-- 3. 主内容区（左右分栏） -->
    <div class="main-body">
      <!-- 左侧：请求列表 -->
      <div class="table-panel">
        <el-table
            :data="filteredList"
            highlight-current-row
            height="100%"
            @current-change="handleSelectRow"
            :row-class-name="tableRowClassName"
        >
          <el-table-column prop="method" label="Method" width="90">
            <template #default="{ row }">
              <span :class="['method-badge', row.method ? row.method.toLowerCase() : '']">
                {{ row.method }}
              </span>
            </template>
          </el-table-column>

          <el-table-column prop="status" label="Status" width="80">
            <template #default="{ row }">
              <span v-if="row.status" :class="['status-code', getStatusClass(row.status)]">
                {{ row.status }}
              </span>
              <span v-else class="status-pending">...</span>
            </template>
          </el-table-column>

          <el-table-column prop="url" label="URL" show-overflow-tooltip />

          <el-table-column prop="clientIp" label="Client IP" width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="ip-text">{{ row.clientIp || '-' }}</span>
            </template>
          </el-table-column>

          <!-- 大小展示 -->
          <el-table-column label="Size" width="90" align="right">
            <template #default="{ row }">
              <span class="size-text">{{ formatBytes(row.respBodySize || row.reqBodySize) }}</span>
            </template>
          </el-table-column>

          <!-- 耗时展示 -->
          <el-table-column prop="costTimeMs" label="Duration" width="90" align="right">
            <template #default="{ row }">
              <span v-if="row.costTimeMs !== null && row.costTimeMs !== undefined" :class="['duration-text', getDurationClass(row.costTimeMs)]">
                {{ row.costTimeMs }}ms
              </span>
              <span v-else class="duration-pending">-</span>
            </template>
          </el-table-column>

          <el-table-column prop="timestamp" label="Time" width="85" align="right">
            <template #default="{ row }">
              <span class="time-text">{{ formatTime(row.timestamp) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 右侧：详情面板 -->
      <div class="detail-panel">
        <template v-if="selectedRow">
          <div class="detail-header">
            <div class="url-info">
              <span :class="['method-badge', selectedRow.method ? selectedRow.method.toLowerCase() : '']">
                {{ selectedRow.method }}
              </span>
              <span class="url-full">{{ selectedRow.url }}</span>
            </div>
            <div class="header-actions">
              <el-button type="primary" plain @click="copyAsCurl(selectedRow)">
                复制 cURL
              </el-button>
            </div>
          </div>

          <el-tabs v-model="activeTab" class="detail-tabs">
            <!-- Headers Tab -->
            <el-tab-pane label="Headers" name="headers">
              <div class="pane-content">
                <div class="meta-section">
                  <span class="meta-label">Request IP:</span>
                  <span class="meta-val">{{ selectedRow.clientIp || '127.0.0.1' }}</span>
                  <span class="meta-label" style="margin-left: 16px;">Request Size:</span>
                  <span class="meta-val">{{ formatBytes(selectedRow.reqBodySize) }}</span>
                  <span class="meta-label" style="margin-left: 16px;">Response Size:</span>
                  <span class="meta-val">{{ formatBytes(selectedRow.respBodySize) }}</span>
                </div>

                <!-- Request Headers -->
                <div class="headers-block">
                  <div class="code-header">
                    <span>Request Headers ({{ Object.keys(selectedRow.reqHeaders || {}).length }})</span>
                  </div>
                  <el-table :data="mapToKvArray(selectedRow.reqHeaders)" border size="small" class="kv-table">
                    <el-table-column prop="key" label="Header Field" width="220" />
                    <el-table-column prop="value" label="Value" />
                  </el-table>
                </div>

                <!-- Response Headers -->
                <div class="headers-block" style="margin-top: 12px;">
                  <div class="code-header">
                    <span>Response Headers ({{ Object.keys(selectedRow.respHeaders || {}).length }})</span>
                  </div>
                  <el-table :data="mapToKvArray(selectedRow.respHeaders)" border size="small" class="kv-table">
                    <el-table-column prop="key" label="Header Field" width="220" />
                    <el-table-column prop="value" label="Value" />
                  </el-table>
                </div>
              </div>
            </el-tab-pane>

            <!-- Query Params Tab -->
            <el-tab-pane label="Params" name="params">
              <div class="pane-content">
                <el-table :data="parseQueryParams(selectedRow.url)" border class="kv-table">
                  <el-table-column prop="key" label="Parameter" width="200" />
                  <el-table-column prop="value" label="Value" />
                </el-table>
              </div>
            </el-tab-pane>

            <!-- Request Body Tab -->
            <el-tab-pane label="Request Body" name="request">
              <div class="pane-content">
                <div class="meta-section">
                  <span class="meta-label">Content-Type:</span>
                  <span>{{ selectedRow.contentType || '-' }}</span>
                  <span class="meta-label" style="margin-left: 20px;">Body Size:</span>
                  <span>{{ formatBytes(selectedRow.reqBodySize) }}</span>
                </div>
                <div class="code-header">
                  <span>Body Payload</span>
                  <el-button link type="primary" @click="copyText(selectedRow.reqBody)">复制</el-button>
                </div>
                <pre class="code-box" v-html="highlightJson(selectedRow.reqBody)"></pre>
              </div>
            </el-tab-pane>

            <!-- Response Body Tab -->
            <el-tab-pane label="Response Body" name="response">
              <div class="pane-content">
                <div class="meta-section">
                  <span class="meta-label">Status Code:</span>
                  <span :class="['status-code', getStatusClass(selectedRow.status)]">
                    {{ selectedRow.status || 'Pending...' }}
                  </span>
                  <span class="meta-label" style="margin-left: 20px;">Latency:</span>
                  <span>{{ selectedRow.costTimeMs !== null ? selectedRow.costTimeMs + 'ms' : '-' }}</span>
                  <span class="meta-label" style="margin-left: 20px;">Body Size:</span>
                  <span>{{ formatBytes(selectedRow.respBodySize) }}</span>
                </div>
                <div class="code-header">
                  <span>Response Data</span>
                  <el-button link type="primary" @click="copyText(selectedRow.respBody)">复制</el-button>
                </div>
                <pre class="code-box" v-html="highlightJson(selectedRow.respBody)"></pre>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>

        <div v-else class="empty-holder">
          <el-icon :size="64" class="empty-icon"><Monitor /></el-icon>
          <p>在左侧列表中点击任意请求查看详细报文</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay, VideoPause, Delete, Search, Monitor, Sunny, Moon } from '@element-plus/icons-vue'
import { onMqttMessage } from "@/util/mqttUtil.js"

const currentTheme = ref('dark')
const isCapturing = ref(true)
const filterText = ref('')
const filterMethod = ref('')
const filterStatus = ref('')

const activeTab = ref('request')
const selectedRow = ref(null)
const captureList = ref([])

let unbindMqtt = null

const toggleTheme = () => {
  currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark'
}

const toggleCapture = () => {
  isCapturing.value = !isCapturing.value
  ElMessage.info(isCapturing.value ? '已开启抓包捕获' : '已暂停抓包捕获')
}

const successCount = computed(() => captureList.value.filter(i => i.status >= 200 && i.status < 300).length)
const errorCount = computed(() => captureList.value.filter(i => i.status >= 400).length)

const filteredList = computed(() => {
  return captureList.value.filter(item => {
    if (filterMethod.value && item.method !== filterMethod.value) return false
    if (filterStatus.value === '2xx' && (item.status < 200 || item.status >= 300)) return false
    if (filterStatus.value === 'err' && (item.status < 400 || !item.status)) return false

    if (filterText.value) {
      const kw = filterText.value.toLowerCase()
      const inUrl = item.url ? item.url.toLowerCase().includes(kw) : false
      const inIp = item.clientIp ? item.clientIp.toLowerCase().includes(kw) : false
      const inReq = item.reqBody ? item.reqBody.toLowerCase().includes(kw) : false
      const inResp = item.respBody ? item.respBody.toLowerCase().includes(kw) : false
      return inUrl || inIp || inReq || inResp
    }

    return true
  })
})

onMounted(() => {
  unbindMqtt = onMqttMessage((topic, message) => {
    if (topic !== 'proxy/captures' || !isCapturing.value) return

    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message

      if (data.type === 'REQUEST') {
        captureList.value.unshift({
          id: data.id,
          method: data.method,
          url: data.url,
          contentType: data.contentType,
          clientIp: data.clientIp,
          reqHeaders: data.headers || {},
          reqBody: data.reqBody,
          reqBodySize: data.reqBodySize || 0,
          timestamp: data.timestamp || Date.now(),
          status: null,
          respHeaders: {},
          respBody: null,
          respBodySize: 0,
          costTimeMs: null
        })

        if (captureList.value.length > 500) {
          captureList.value.pop()
        }
      } else if (data.type === 'RESPONSE') {
        const target = captureList.value.find(item => item.id === data.id)
        if (target) {
          target.status = data.status
          target.respHeaders = data.headers || {}
          target.respBody = data.respBody
          target.respBodySize = data.respBodySize || 0
          target.costTimeMs = data.costTimeMs !== undefined ? data.costTimeMs : (data.timestamp - target.timestamp)
        }
      }
    } catch (e) {
      console.error('解析抓包报文失败:', e)
    }
  })
})

onUnmounted(() => {
  if (unbindMqtt) unbindMqtt()
})

const mapToKvArray = (headersObj) => {
  if (!headersObj) return []
  return Object.keys(headersObj).map(key => ({
    key,
    value: headersObj[key]
  }))
}

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const highlightJson = (jsonStr) => {
  if (!jsonStr) return '<span class="token-null">// (Empty Body)</span>'

  let formatted = ''
  try {
    const obj = typeof jsonStr === 'object' ? jsonStr : JSON.parse(jsonStr)
    formatted = JSON.stringify(obj, null, 2)
  } catch (e) {
    return String(jsonStr).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  formatted = formatted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return formatted.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'token-number'
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'token-key'
          } else {
            cls = 'token-string'
          }
        } else if (/true|false/.test(match)) {
          cls = 'token-boolean'
        } else if (/null/.test(match)) {
          cls = 'token-null'
        }
        return `<span class="${cls}">${match}</span>`
      }
  )
}

const parseQueryParams = (urlStr) => {
  if (!urlStr) return []
  try {
    const queryIdx = urlStr.indexOf('?')
    if (queryIdx === -1) return []
    const searchParams = new URLSearchParams(urlStr.substring(queryIdx + 1))
    const result = []
    for (const [key, value] of searchParams.entries()) {
      result.push({ key, value })
    }
    return result
  } catch (e) {
    return []
  }
}

const copyAsCurl = (row) => {
  if (!row) return
  let curl = `curl -X ${row.method} "${row.url}"`

  if (row.reqHeaders) {
    Object.keys(row.reqHeaders).forEach(key => {
      curl += ` -H "${key}: ${row.reqHeaders[key]}"`
    })
  }

  if (row.reqBody) {
    const bodyStr = typeof row.reqBody === 'object' ? JSON.stringify(row.reqBody) : row.reqBody
    curl += ` -d '${bodyStr.replace(/'/g, "\\'")}'`
  }
  copyText(curl)
}

const handleSelectRow = (row) => {
  if (!row) return
  selectedRow.value = row
}

const clearLogs = () => {
  captureList.value = []
  selectedRow.value = null
  ElMessage.success('列表已清空')
}

const getStatusClass = (status) => {
  if (!status) return ''
  if (status >= 200 && status < 300) return 'status-2xx'
  if (status >= 300 && status < 400) return 'status-3xx'
  if (status >= 400 && status < 500) return 'status-4xx'
  return 'status-5xx'
}

const getDurationClass = (duration) => {
  if (duration > 1000) return 'duration-slow'
  if (duration > 500) return 'duration-medium'
  return 'duration-fast'
}

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toTimeString().split(' ')[0]
}

const copyText = (text) => {
  if (!text) {
    ElMessage.warning('内容为空')
    return
  }
  const content = typeof text === 'object' ? JSON.stringify(text, null, 2) : text
  navigator.clipboard.writeText(content).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const tableRowClassName = ({ row }) => {
  return selectedRow.value && selectedRow.value.id === row.id ? 'active-row' : ''
}
</script>

<style scoped>
/* ==================== 1. 主题变量定义 ==================== */
.capture-workspace.dark {
  --bg-main: #1e1e24;
  --bg-top: #18181c;
  --bg-panel: #21252b;
  --border-color: #2d2d35;
  --text-primary: #abb2bf;
  --text-muted: #7f848e;
  --table-header-bg: #18181c;
  --table-hover: #282c34;
  --code-bg: #18181c;

  --token-key: #e06c75;
  --token-string: #98c379;
  --token-number: #d19a66;
  --token-boolean: #56b6c2;
  --token-null: #c678dd;
}

.capture-workspace.light {
  --bg-main: #f4f6f9;
  --bg-top: #ffffff;
  --bg-panel: #ffffff;
  --border-color: #dcdfe6;
  --text-primary: #2c3e50;
  --text-muted: #8c92a4;
  --table-header-bg: #f5f7fa;
  --table-hover: #f0f2f5;
  --code-bg: #f8f9fa;

  --token-key: #a626a4;
  --token-string: #50a14f;
  --token-number: #986801;
  --token-boolean: #0184bc;
  --token-null: #a0a1a7;
}

/* ==================== 2. 布局 & 样式 ==================== */
.capture-workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-main);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  transition: background-color 0.3s, color 0.3s;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: var(--bg-top);
  border-bottom: 1px solid var(--border-color);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  font-size: 16px;
}

.stats-bar {
  display: flex;
  gap: 24px;
  background: var(--bg-panel);
  padding: 6px 20px;
  border-radius: 20px;
  font-size: 13px;
  border: 1px solid var(--border-color);
}

.stat-item { display: flex; gap: 8px; align-items: center; }
.stat-label { color: var(--text-muted); }
.stat-value { font-weight: bold; font-size: 14px; }
.stat-value.success { color: #67c23a; }
.stat-value.error { color: #f56c6c; }

.actions { display: flex; align-items: center; gap: 12px; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
  background-color: var(--bg-top);
  border-bottom: 1px solid var(--border-color);
}

.search-input { width: 320px; }
.filter-count { font-size: 13px; color: var(--text-muted); margin-left: auto; }

.main-body { display: flex; flex: 1; overflow: hidden; }

.table-panel {
  flex: 1.3;
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

/* 适配 Element Plus 表格与主题切换 */
:deep(.el-table) {
  font-size: 13px;
  --el-table-bg-color: var(--bg-main);
  --el-table-tr-bg-color: var(--bg-main);
  --el-table-header-bg-color: var(--table-header-bg);
  --el-table-header-text-color: var(--text-muted);
  --el-table-border-color: var(--border-color);
  --el-table-text-color: var(--text-primary);
  --el-table-row-hover-bg-color: var(--table-hover);
}

:deep(.el-table .cell) {
  padding: 8px 12px;
}

.kv-table {
  --el-table-bg-color: var(--bg-panel);
  --el-table-tr-bg-color: var(--bg-panel);
}

.ip-text { font-family: monospace; font-size: 12px; color: var(--text-muted); }
.size-text { font-family: monospace; font-size: 12px; color: var(--text-muted); }
.time-text { font-size: 12px; color: var(--text-muted); font-family: monospace; }

.detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-top);
  padding: 16px;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 14px;
}

.url-info { display: flex; align-items: center; gap: 10px; overflow: hidden; }
.url-full { font-family: monospace; font-size: 13px; color: #409eff; word-break: break-all; }

.detail-tabs { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
:deep(.el-tabs__content) { flex: 1; overflow-y: auto; padding: 12px 0; }
:deep(.el-tabs__item) { font-size: 14px; font-weight: 500; }

.pane-content { display: flex; flex-direction: column; gap: 12px; height: 100%; }

.meta-section {
  background-color: var(--bg-panel);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--border-color);
}

.meta-label { color: var(--text-muted); margin-right: 6px; }
.meta-val { font-family: monospace; color: var(--text-primary); }
.code-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px; }

/* 代码盒容器 */
.code-box {
  background-color: var(--code-bg);
  padding: 14px;
  border-radius: 6px;
  font-family: "Fira Code", Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  margin: 0;
}

.empty-holder {
  display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 16px; font-size: 14px;
}
.empty-icon { color: var(--text-muted); opacity: 0.6; }

/* Method Badges */
.method-badge { font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 4px; display: inline-block; text-align: center; }
.method-badge.get { background: #e8f5e9; color: #2e7d32; }
.method-badge.post { background: #fff3e0; color: #ef6c00; }
.method-badge.delete { background: #ffebee; color: #c62828; }
.method-badge.put { background: #e3f2fd; color: #1565c0; }

.dark .method-badge.get { background: #2d3f32; color: #98c379; }
.dark .method-badge.post { background: #3e382b; color: #d19a66; }
.dark .method-badge.delete { background: #3f2d2d; color: #e06c75; }
.dark .method-badge.put { background: #2d373f; color: #61afef; }

/* Status Code */
.status-code { font-weight: bold; font-family: monospace; font-size: 13px; }
.status-2xx { color: #67c23a; }
.status-3xx { color: #409eff; }
.status-4xx, .status-5xx { color: #f56c6c; }
.status-pending { color: #e6a23c; }

/* Latency / Duration Style */
.duration-text { font-size: 12px; font-family: monospace; }
.duration-fast { color: var(--text-muted); }
.duration-medium { color: #e6a23c; font-weight: bold; }
.duration-slow { color: #f56c6c; font-weight: bold; }

/* JSON Token Highlighting */
:deep(.token-key) { color: var(--token-key); font-weight: bold; }
:deep(.token-string) { color: var(--token-string); }
:deep(.token-number) { color: var(--token-number); }
:deep(.token-boolean) { color: var(--token-boolean); font-weight: bold; }
:deep(.token-null) { color: var(--token-null); font-style: italic; }
</style>