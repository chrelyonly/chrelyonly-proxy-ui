<script setup>
import { onMounted, onUnmounted } from 'vue'
import { connectMqtt, subscribeTopic, disconnectMqtt } from "@/util/mqttUtil.js"

onMounted(() => {
  const wssClient = connectMqtt()

  wssClient.on('connect', () => {
    console.log('✅ MQTT 全局已连接')
    // 订阅你的抓包数据主题
    subscribeTopic('proxy/captures')
  })

  wssClient.on('error', (err) => {
    console.error('❌ MQTT 连接失败:', err)
  })
})

onUnmounted(() => {
  disconnectMqtt()
})
</script>

<template>
  <RouterView />
</template>