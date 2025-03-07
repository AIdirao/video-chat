import http from "http";
import SocketIO from "socket.io";
import express from "express";
import path from "path";
import { instrument } from "@socket.io/admin-ui";
import crypto from "crypto";

//aws s3 db
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; 
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid"; // UUID 라이브러리 추가


dotenv.config(); 

const app = express();
app.use(express.json()); // JSON 요청 처리

// pug 설정
app.set('view engine', "pug");
app.set("views", __dirname + "/views");
// 정적 파일 제공
app.use("/public", express.static(path.resolve(__dirname, "public")));
app.use("/models", express.static(path.resolve(__dirname, "public/models")));
app.use("/nsfw_model", express.static(path.resolve(__dirname, "public/nsfw_model")));

// 라우팅 설정
app.get("/", (req, res) => res.render("start"));
app.get("/meeting", (req, res) => res.render("meeting"));
app.get("/privacyset", (req, res) => res.render("privacyset"));
app.get("/waiting", (req, res) => res.render("waiting"));

/* AWS S3 설정 */
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Presigned URL 생성 API 추가
app.post("/generate-presigned-url", async (req, res) => {
    try {
        console.log("/generate-presigned-url API 요청 도착!");

        const { fileName, fileType } = req.body;
        console.log(`요청된 파일: ${fileName}, 타입: ${fileType}`);

        const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

        // 파일명에 UUID 추가하여 덮어쓰기 방지
        const uniqueFileName = `${uuidv4()}-${fileName}`;
        console.log(`S3 Presigned URL 생성 중: ${uniqueFileName}`);

        // S3 Presigned URL 생성
        const params = {
            Bucket: BUCKET_NAME,
            Key: `uploads/${uniqueFileName}`,
            ContentType: fileType,
            // 이거 주석 지우면 오류
            // ACL: "public-read"
        };

        const command = new PutObjectCommand(params);
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 }); //  10분 유효

        const uploadedFileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/uploads/${uniqueFileName}`;

        console.log(`Presigned URL 생성 완료: ${presignedUrl}`);
        console.log(`업로드 예상 경로: ${uploadedFileUrl}`);

        res.json({ presignedUrl, fileUrl: uploadedFileUrl });
    } catch (error) {
        console.error("Presigned URL 생성 실패:", error);
        res.status(500).json({ error: "Failed to generate presigned URL" });
    }
});



/* Socket 연결 서버 */

// http & websocket 서버 생성
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);


const activeRooms = new Map(); // roomID -> { roomName, members }

// 회의 코드 생성 난수 (12자리 random)
function generateRoomCode() {
    return crypto.randomBytes(6).toString("hex").toUpperCase(); // 6바이트 → 12자리 HEX 문자열
}


wsServer.on("connection", (socket) => {
    // 새 회의 생성
    socket.on("create_room", ({ roomName }, done) => {
        const roomID = generateRoomCode();
        activeRooms.set(roomID, { roomName, members: new Set() });

        // 입장
        socket.join(roomID);
        activeRooms.get(roomID).members.add(socket.id);
        console.log(`[SERVER] Room created: ${roomID} (Name: ${roomName}, Host: ${socket.id})`);

        done({ roomID, roomName });

        // 입장 완료 후 클라이언트에 알림
        socket.emit("room_created", { roomID, roomName });
    });
    
    // 회의 코드로 방 입장
    // start.js에서 방 존재 확인
    socket.on("check_room", (roomID, callback) => {
        console.log(`[SERVER] Checking if room ${roomID} exists`);
    
        if (!activeRooms.has(roomID)) {
            console.log(`[SERVER] Room ${roomID} does not exist`);
            return callback({ error: "Room does not exist" });
        }
    
        console.log(`[SERVER] Room ${roomID} exists`);
        return callback({ success: true, roomName: activeRooms.get(roomID).roomName });
    });

    // meeting.js에서 입장
    socket.on("join_room", (roomID, nn, done) => {
        console.log("[SERVER] joining room..");
        socket.join(roomID);
        const roomInfo = activeRooms.get(roomID);
        const nickname = nn;
        roomInfo.members.add(socket.id);
        console.log(`[SERVER] User ${nickname}(${socket.id}) joined room: ${roomID}`);
    
        done({ success: true, roomName: roomInfo.roomName });
       
        // welcome을 보내기 전 현재 방에 속한 사용자 목록 출력
        const clients = Array.from(wsServer.sockets.adapter.rooms.get(roomID) || []);
        console.log(`📡 [SERVER] Users in room ${roomID}:`, clients);
    
        // welcome 전송송
        socket.to(roomID).emit("welcome", { user: nickname });
        console.log(`[SERVER] Sent "welcome" event to room ${roomID}, for user: ${nickname}(${socket.id})`);
    });
    

    socket.on("offer", (offer, roomID) => {
        console.log(`WebRTC Offer 전송 -> ${roomID}`);
        socket.to(roomID).emit("offer", offer);
    });
    
    socket.on("answer", (answer, roomID) => {
        console.log(`WebRTC Answer 전송 -> ${roomID}`);
        socket.to(roomID).emit("answer", answer);
    });
    
    socket.on("ice", (ice, roomID) => {
        console.log(`ICE Candidate 전송 -> ${roomID}`);
        socket.to(roomID).emit("ice", ice);
    });
    
    
    //디버깅
    socket.on("list_rooms", (callback) => {
        const rooms = io.sockets.adapter.rooms;
        callback([...rooms.keys()]); // 현재 존재하는 방 목록 반환
    });

    

    // 퇴장
    // socket.on("disconnecting", () => {
    //     for (const roomID of socket.rooms) {
    //         if (roomID !== socket.id) {
    //             console.log(`User ${socket.id} left room: ${roomID}`);
    //             socket.to(roomID).emit("user_left", { user: socket.id });
    //         }
    //     }
    // });
});



const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);