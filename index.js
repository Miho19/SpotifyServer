import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { v4 as uuid } from "uuid";

import Dayjs from "dayjs";

const app = express();
const httpServer = createServer(app);

const PORT = 4000;
const HOST = "localhost";
const CORSORIGIN = "http://localhost:3000";

const EVENTS = {
  connection: "connection",
  disconnect: "disconnect",
  CLIENT: {
    CREATE_ROOM: "CREATE_ROOM",
    SET_USER_PROFILE: "SET_USER_PROFILE",
    JOIN_ROOM: "JOIN_ROOM",
    SEND_MESSAGE: "SEND_MESSAGE",
    LEAVE_ROOM: "LEAVE_ROOM",
    GET_ROOM_MEMBERS: "GET_ROOM_MEMBERS",
  },
  SERVER: {
    CLIENT_JOINED_ROOM: "CLIENT_JOINED_ROOM",
    CLIENT_LEFT_ROOM: "CLIENT_LEFT_ROOM",
    EMIT_MESSAGE: "EMIT_MESSAGE",
    SEND_ROOM_MEMBERS: "SEND_ROOM_MEMBERS",
  },
};

const rooms = {};

const io = new Server(httpServer, {
  cors: {
    origin: CORSORIGIN,
    credentials: true,
  },
});

app.get("/", (req, res) => {
  res.send("Server up");
});

httpServer.listen(PORT, HOST, () => {
  console.log("Server Listening");
});

io.on("connection", (socket) => {
  console.log(`socket user: ${socket.id} connected`);

  socket.on(EVENTS.disconnect, () => {
    console.log("user disconeccted");
  });

  socket.on(EVENTS.CLIENT.CREATE_ROOM, ({ roomName }) => {
    const newRoomID = uuid();

    if (socket.rooms.size > 1) {
      const currentRoomID = [...socket.rooms][1];

      const currentRoom = rooms[currentRoomID].name;

      socket.emit(EVENTS.SERVER.EMIT_MESSAGE, {
        message: `Leave '${currentRoom}' first.`,
        email: "__ADMIN__",
        id: uuid(),
        time: Dayjs(),
      });

      return;
    }

    rooms[String(newRoomID)] = {
      name: roomName,
      totalMembers: 1,
      members: new Set().add({
        name: socket.data.user.name,
        imgSource: socket.data.user.imgSource,
      }),
    };

    socket.join(newRoomID);
    socket.emit(EVENTS.SERVER.CLIENT_JOINED_ROOM, {
      roomID: newRoomID,
      roomName: roomName,
    });
  });

  socket.on(EVENTS.CLIENT.LEAVE_ROOM, () => {
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];

    socket.leave(currentRoomID);

    rooms[String(currentRoomID)].totalMembers -= 1;
    socket.emit(EVENTS.SERVER.CLIENT_LEFT_ROOM);
  });

  socket.on(EVENTS.CLIENT.SEND_MESSAGE, ({ message, email, roomID }) => {
    io.to(roomID).emit(EVENTS.SERVER.EMIT_MESSAGE, {
      message: message,
      email: email,
      id: uuid(),
      time: Dayjs(),
    });
  });

  socket.on(EVENTS.CLIENT.GET_ROOM_MEMBERS, ({ roomID }) => {
    if (!Object.prototype.hasOwnProperty.call(rooms, String(roomID))) return;

    const roomMembers = [...rooms[String(roomID)].members];
    socket.emit(EVENTS.SERVER.SEND_ROOM_MEMBERS, { roomMembers });
  });

  socket.on(EVENTS.CLIENT.SET_USER_PROFILE, ({ name, imgSource, email }) => {
    socket.data.user = { name, imgSource, email };
  });
});
