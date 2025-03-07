

const socket = io("ws://15.164.211.147:3000", { 
    transports: ["websocket"], // 🚀 WebSocket 전용
    upgrade: false, // 🚀 polling 차단 (WebSocket만 사용)
});

export default socket;