<script setup>
import {connectMqtt} from "@/util/mqttUtil.js";

let wssClient = null;

//   发起wss链接
wssClient = connectMqtt()
wssClient.on('connect', () => {
  console.log('MQTT 已连接')
  // 订阅主题
  wssClient.subscribe('test/topic', (err) => {
    if (!err) {
      console.log('订阅成功')
    }
  })
})
</script>

<template>
  <RouterView />
</template>
