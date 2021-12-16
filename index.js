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
    JOIN_ROOM: "JOIN_ROOM",
    SEND_MESSAGE: "SEND_MESSAGE",
    LEAVE_ROOM: "LEAVE_ROOM",
  },
  SERVER: {
    CLIENT_JOINED_ROOM: "CLIENT_JOINED_ROOM",
    CLIENT_LEFT_ROOM: "CLIENT_LEFT_ROOM",
    EMIT_MESSAGE: "EMIT_MESSAGE",
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
    const newRoomId = uuid();

    rooms[String(newRoomId)] = {
      name: roomName,
      usersInChat: 1,
    };

    if (socket.rooms.size > 1) {
      const currentRoomId = [...socket.rooms][1];

      const currentRoom = rooms[currentRoomId].name;

      socket.emit(EVENTS.SERVER.EMIT_MESSAGE, {
        message: `Leave '${currentRoom}' first.`,
        email: "__ADMIN__",
        id: uuid(),
        time: Dayjs(),
      });

      return;
    }

    socket.join(newRoomId);
    socket.emit(EVENTS.SERVER.CLIENT_JOINED_ROOM, {
      roomId: newRoomId,
      roomName: roomName,
    });
  });

  socket.on(EVENTS.CLIENT.LEAVE_ROOM, () => {
    if (socket.rooms.size === 1) return;

    const currentRoomId = [...socket.rooms][1];

    socket.leave(currentRoomId);

    rooms[String(currentRoomId)].usersInChat -= 1;
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
});
