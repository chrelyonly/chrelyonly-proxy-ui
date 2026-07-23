<template>
  <div class="capture-container">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <el-button :type="isCapturing ? 'danger' : 'success'" @click="toggleCapture">
        {{ isCapturing ? '停止抓包' : '开始抓包' }}
      </el-button>
      <el-button @click="clearLogs">清空列表</el-button>
      <el-input v-model="filterText" placeholder="过滤 URL..." style="width: 250px; margin-left: 10px;" />
    </div>

    <!-- 主体区域：左右分割 -->
    <div class="main-content">
      <!-- 左侧：请求列表 -->
      <div class="left-panel">
        <el-table
            :data="filteredList"
            highlight-current-row
            @current-change="handleSelectRow"
            height="100%"
            size="small"
        >
          <el-table-column prop="method" label="Method" width="80">
            <template #default="{ row }">
              <el-tag :type="getMethodTag(row.method)">{{ row.method }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="status" label="Status" width="80">
            <template #default="{ row }">
              <span :class="row.status >= 400 ? 'status-error' : 'status-ok'">
                {{ row.status || '-' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column prop="url" label="URL" show-overflow-tooltip />
        </el-table>
      </div>

      <!-- 右侧：详情面板 -->
      <div class="right-panel">
        <template v-if="selectedRow">
          <el-tabs type="border-card">
            <!-- 请求详情 -->
            <el-tab-pane label="Request Body">
              <pre class="code-block">{{ formatJson(selectedRow.reqBody) }}</pre>
            </el-tab-pane>

            <!-- 响应详情 -->
            <el-tab-pane label="Response Body">
              <pre class="code-block">{{ formatJson(selectedRow.respBody) }}</pre>
            </el-tab-pane>
          </el-tabs>
        </template>
        <el-empty v-else description="请选择左侧的请求查看详情" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import mqtt from 'mqtt';

const isCapturing = ref(true);
const filterText = ref('');
const captureList = ref([]);
const selectedRow = ref(null);
let client = null;

// 计算属性：过滤 URL
const filteredList = computed(() => {
  if (!filterText.value) return captureList.value;
  return captureList.value.filter(item =>
      item.url.toLowerCase().includes(filterText.value.toLowerCase())
  );
});

// 初始化 MQTT 连接 (连接 Mica-MQTT 的 WebSocket 端口，默认通常是 8083 或自定义端口)
const initMqtt = () => {
  // 替换为你 mica-mqtt 的 websocket 端口，例如 ws://127.0.0.1:8083/mqtt
  client = mqtt.connect('ws://127.0.0.1:8083/mqtt', {
    clientId: 'vue_capture_client_' + Math.random().toString(16).substring(2, 8),
    clean: true
  });

  client.on('connect', () => {
    console.log('MQTT 连接成功！开始订阅抓包主题...');
    client.subscribe('proxy/captures');
  });

  client.on('message', (topic, message) => {
    if (!isCapturing.value) return;

    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'REQUEST') {
        // 收到新请求，追加到列表开头
        captureList.value.unshift(data);
      } else if (data.type === 'RESPONSE') {
        // 收到响应，根据 ID 更新列表中对应的请求项
        const target = captureList.value.find(item => item.id === data.id);
        if (target) {
          target.status = data.status;
          target.respBody = data.respBody;
        }
      }
    } catch (e) {
      console.error('解析 MQTT 数据包异常', e);
    }
  });
};

const toggleCapture = () => {
  isCapturing.value = !isCapturing.value;
};

const clearLogs = () => {
  captureList.value = [];
  selectedRow.value = null;
};

const handleSelectRow = (row) => {
  selectedRow.value = row;
};

const getMethodTag = (method) => {
  switch (method) {
    case 'GET': return 'success';
    case 'POST': return 'warning';
    case 'DELETE': return 'danger';
    default: return 'info';
  }
};

const formatJson = (content) => {
  if (!content) return 'Empty / Binary Data';
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch (e) {
    return content; // 不是 JSON 则原样文本输出
  }
};

onMounted(() => {
  initMqtt();
});

onUnmounted(() => {
  if (client) client.end();
});
</script>

<style scoped>
.capture-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 10px;
  box-sizing: border-box;
}

.toolbar {
  margin-bottom: 10px;
}

.main-content {
  display: flex;
  flex: 1;
  gap: 10px;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  border: 1px solid #e4e7ed;
  height: 100%;
}

.right-panel {
  flex: 1;
  border: 1px solid #e4e7ed;
  height: 100%;
  overflow-y: auto;
}

.code-block {
  background-color: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.status-ok { color: #67c23a; font-weight: bold; }
.status-error { color: #f56c6c; font-weight: bold; }
</style>