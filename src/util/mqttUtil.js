import mqtt from 'mqtt'

let client = null
const messageListeners = new Set() // 存储所有消息监听器

export function connectMqtt(options = {}) {
    if (client && client.connected) {
        return client // 避免重复连接
    }

    const {
        url = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8083/mqtt',
        clientId = 'vue_' + Math.random().toString(16).slice(2),
        username = "admin",
        password = "admin",
        keepalive = 60,
    } = options

    client = mqtt.connect(url, {
        clientId,
        username,
        password,
        keepalive,
        clean: true,
        reconnectPeriod: 3000,
    })

    // 全局只分发一次 message 事件
    client.on('message', (topic, payload) => {
        const messageStr = payload.toString()
        // 触发所有已注册的监听器
        messageListeners.forEach(listener => listener(topic, messageStr))
    })

    return client
}

export function getClient() {
    return client
}

/**
 * 订阅主题的快捷工具
 */
export function subscribeTopic(topic) {
    if (client) {
        client.subscribe(topic, (err) => {
            if (!err) console.log(`[MQTT] 成功订阅主题: ${topic}`)
        })
    }
}

/**
 * 页面/组件添加 MQTT 消息监听
 * @returns {Function} unbind 取消监听的函数
 */
export function onMqttMessage(callback) {
    messageListeners.add(callback)
    // 返回一个用于在组件销毁时调用的解绑函数
    return () => {
        messageListeners.delete(callback)
    }
}

export function disconnectMqtt() {
    if (client) {
        client.end()
        client = null
        messageListeners.clear()
    }
}