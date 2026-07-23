import mqtt from 'mqtt'

let client = null

export function connectMqtt(options) {
    const {
        url = import.meta.env.VITE_WS_URL + '/wss',
        clientId = 'vue_' + Math.random().toString(16).slice(2),
        username = "admin",
        password = "admin",
        keepalive = 60,
    } = options || {}

    client = mqtt.connect(url, {
        clientId,
        username,
        password,
        keepalive,
        clean: true,
        reconnectPeriod: 3000, // 自动重连
    })

    return client
}

export function getClient() {
    return client
}

export function disconnectMqtt() {
    if (client) {
        client.end()
        client = null
    }
}