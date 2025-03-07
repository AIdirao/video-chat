

const socket = io("http://localhost:3000", { 
    transports: ["websocket"], // 🚀 WebSocket 전용
    upgrade: false, // 🚀 polling 차단 (WebSocket만 사용)
});

export default socket;
