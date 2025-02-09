const socket = io(); 

const createMeetingForm = document.getElementById("createMeetingForm");
const enterCodeForm = document.getElementById("enterCodeForm");

createMeetingForm.addEventListener("submit", event => {
    event.preventDefault();
    const roomName = createMeetingForm.querySelector("input[name='roomName']").value;
    socket.emit("create_room", roomName); // 서버에 새 회의 생성 요청
    window.location.href = '/privacyset'; // 'privacyset.pug'로 이동
});

enterCodeForm.addEventListener("submit", event => {
    event.preventDefault();
    const roomID = enterCodeForm.querySelector("input[name='roomID']").value;
    socket.emit("join_room", roomID); // 서버에 회의 참여 요청
    window.location.href = '/privacyset'; // 'privacyset.pug'로 이동
});
