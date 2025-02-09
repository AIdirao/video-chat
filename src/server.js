import http from "http";
import SocketIO from "socket.io";
import express from "express";
import { instrument } from "@socket.io/admin-ui";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use('/public', express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("start"));
app.get("/meeting", (req, res) => res.render("meeting"));
app.get("/privacyset", (req, res) => res.render("privacyset"));
app.get("/waiting", (req, res) => res.render("waiting"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

const rooms = {}; // 방 정보를 저장할 객체를 전역 변수로 선언

wsServer.on("connection", socket => {
    socket.on("create_room", roomName => {
        const roomID = Date.now().toString(); // 방 ID 생성
        rooms[roomID] = { roomName, host: socket.id, members: [socket.id] }; // 방 정보 저장
        socket.join(roomID);
        socket.emit("room_created", roomID); // 클라이언트에 방 ID 전송
    });

    socket.on("join_room", roomID => {
        if (rooms[roomID]) { // 방이 존재하는지 확인
            rooms[roomID].members.push(socket.id);
            socket.join(roomID);
            socket.to(roomID).emit("welcome", roomID); // 방에 있는 다른 참가자들에게 알림
            socket.emit("joined_room", roomID); // 참가한 사용자에게 방 정보 전송
        } else {
            socket.emit("room_error", "Room does not exist"); // 방이 존재하지 않을 경우 오류 메시지 전송
        }
    });
});

const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);
