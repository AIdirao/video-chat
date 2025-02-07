import http from "http";
import SocketIO from "socket.io";
import express from "express";
import { instrument } from "@socket.io/admin-ui";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use('/public', express.static(__dirname + "/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

wsServer.on("connection", socket => {
    socket.on("join_room", (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit("welcome");
    });
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    });
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer);
    });
    socket.on("ice", (ice, roomName)=>{
        socket.to(roomName).emit("ice", ice);
    });
})

const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);














// /* SocketIO */
// const httpServer = http.createServer(app);
// const wsServer = new Server(httpServer, {
//     cors: {
//         origin: ["https://admin.socket.io"],
//         credentials: true
//     }
// });
// instrument(wsServer, {
//     auth: false,
//     mode: "development",
//   });

// function publicRooms(){
//     const{
//         sockets: {
//             adapter: {sids, rooms},
//         },
//     } = wsServer;
//     const publicRooms = [];
//     rooms.forEach((_,key) => {
//         if(sids.get(key) === undefined){
//             publicRooms.push(key);
//         }
//     });
//     return publicRooms;
// }

// function countRoom(roomName){
//     return wsServer.sockets.adapter.rooms.get(roomName)?.size;
// }


// wsServer.on("connection", (socket) => {
//     socket["nickname"] = "Anon";
//     socket.onAny((event)=> {
//         console.log(wsServer.sockets.adapter);
//         console.log(`Socket Event: ${event}`);
//     });
//     socket.on("enter_room", (roomName, done) => {
//         // join the room
//         socket.join(roomName);

//         //remove form and enter room
//         done();

//         //send msg to everybody
//         socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));

//         //nofiticate that new room has created to everyone in the server
//         wsServer.sockets.emit("room_change", publicRooms());

//     });
//     //disconnecting 
//     //but doesnt mean lefting the room
//     //saying bye to everyone in the room
//     socket.on("disconnecting", () => {
//         socket.rooms.forEach((room) => {
//             socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1);
//         });
//     });
    

//     socket.on("disconnect", () =>{
//         //disconnect 후 room change 시 
//         wsServer.sockets.emit("room_change", publicRooms());
//     });

//     socket.on("new_message", (msg, room,done)=> {
//         socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
//         done();
//     });

//     socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
// });


