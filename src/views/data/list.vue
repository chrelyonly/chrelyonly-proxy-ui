<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { onMqttMessage } from "@/util/mqttUtil.js"

const captureList = ref([])
let unbindMqtt = null

onMounted(() => {
  // 监听来自 mqttUtil 统一推送的消息
  unbindMqtt = onMqttMessage((topic, message) => {
    if (topic === 'proxy/captures') {
      try {
        const item = JSON.parse(message)
        // 拼接到抓包列表
        captureList.value.unshift(item)
      } catch (e) {
        console.error('解析抓包报文失败', e)
      }
    }
  })
})

// 组件销毁时自动移除监听器，防止多余的回调导致内存泄漏
onUnmounted(() => {
  if (unbindMqtt) unbindMqtt()
})
</script>

<template>
  <div class="capture-page">
    <h2>抓包实时监控</h2>
    <ul>
      <li v-for="(item, index) in captureList" :key="index">
        {{ item.method }} - {{ item.url }}
      </li>
    </ul>
  </div>
</template>