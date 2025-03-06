// import { io } from "socket.io-client";

// const socket = io({
//     transports: ["websocket"], // WebSocket 연결 유지 (불필요한 HTTP polling 방지)
//     reconnection: true,        // 연결 끊어지면 자동 재연결
//     reconnectionAttempts: 5,   // 최대 5번 재연결 시도
//     reconnectionDelay: 1000    // 1초 후 재연결 시도
// });

// export default socket;
const socket = io("http://15.164.211.147:3000"); // 서버에서 자동으로 클라이언트 라이브러리를 제공
export default socket;
