import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { v4 as uuid } from "uuid";

import Dayjs from "dayjs";
import { join } from "path";

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
    GET_ROOM_LIST: "GET_ROOM_LIST",
  },
  SERVER: {
    CLIENT_JOINED_ROOM: "CLIENT_JOINED_ROOM",
    CLIENT_LEFT_ROOM: "CLIENT_LEFT_ROOM",
    EMIT_MESSAGE: "EMIT_MESSAGE",
    SEND_ROOM_MEMBERS: "SEND_ROOM_MEMBERS",
    SEND_ROOM_LIST: "SEND_ROOM_LIST",
  },
};

const rooms = {
  1: {
    name: "Party House #1",
    totalMembers: 0,
    members: new Set(),
    inviteLinks: [
      {
        linkID: uuid(),
        timeExpire: new Dayjs("2100-12-24T08:17:55+0000"),
      },
    ],
  },
  2: {
    name: "Party House #2",
    totalMembers: 0,
    members: new Set(),
    inviteLinks: [
      {
        linkID: uuid(),
        timeExpire: new Dayjs("2100-12-24T08:17:55+0000"),
      },
    ],
  },
  3: {
    name: "Party House #3",
    totalMembers: 0,
    members: new Set(),
    inviteLinks: [
      {
        linkID: uuid(),
        timeExpire: new Dayjs("2100-12-24T08:17:55+0000"),
      },
    ],
  },
};

const inviteLinkToRoomKey = {};

Object.keys(rooms).forEach((roomID) => {
  rooms[roomID].inviteLinks.forEach((link) => {
    inviteLinkToRoomKey[link.linkID] = {
      roomID: roomID,
    };
  });
});

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

const removeMember = (currentRoomID, userName) => {
  if (!rooms) return;
  if (!userName) return;
  if (!rooms[currentRoomID]) return;

  rooms[String(currentRoomID)].totalMembers -= 1;
  rooms[String(currentRoomID)].members.forEach((member) => {
    if (member.name === userName) {
      rooms[String(currentRoomID)].members.delete(member);
    }
  });
};

io.on("connection", (socket) => {
  console.log(`socket user: ${socket.id} connected`);

  socket.on(EVENTS.disconnect, () => {
    console.log("user disconeccted");
  });

  socket.on("disconnecting", (reason) => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name);
  });

  socket.on(EVENTS.CLIENT.CREATE_ROOM, ({ roomName }) => {
    const newRoomID = uuid();

    if (socket.rooms.size > 1) {
      const currentRoomID = [...socket.rooms][1];

      const currentRoom = rooms[currentRoomID].name;

      socket.emit(EVENTS.SERVER.EMIT_MESSAGE, {
        message: `Leave '${currentRoom}' first.`,
        senderID: "__ADMIN__",
        messagaeID: uuid(),
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

  socket.on(EVENTS.CLIENT.JOIN_ROOM, ({ joinLink }) => {
    if (!joinLink) return;

    const time = Dayjs();

    if (socket.rooms.size > 1) {
      const currentRoomID = [...socket.rooms][1];

      const currentRoom = rooms[currentRoomID].name;

      socket.emit(EVENTS.SERVER.EMIT_MESSAGE, {
        message: `Leave '${currentRoom}' first.`,
        senderID: "__ADMIN__",
        messagaeID: uuid(),
        time: time,
      });
    }

    const query = inviteLinkToRoomKey[joinLink];
    if (!query) return;

    const roomID = query.roomID;

    socket.join(roomID);

    rooms[roomID].totalMembers += 1;
    rooms[roomID].members.add({
      name: socket.data.user.name,
      imgSource: socket.data.user.imgSource,
      timeJoined: time,
    });

    socket.emit(EVENTS.SERVER.CLIENT_JOINED_ROOM, {
      roomID: roomID,
      roomName: rooms[roomID].name,
    });
  });

  socket.on(EVENTS.CLIENT.LEAVE_ROOM, () => {
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];

    socket.leave(currentRoomID);

    removeMember(currentRoomID, socket.data.user.name);
    socket.emit(EVENTS.SERVER.CLIENT_LEFT_ROOM);
  });

  socket.on(EVENTS.CLIENT.SEND_MESSAGE, ({ message }) => {
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];

    io.to(currentRoomID).emit(EVENTS.SERVER.EMIT_MESSAGE, {
      message: message,
      senderID: socket.id,
      messageID: uuid(),
      time: Dayjs(),
    });
  });

  socket.on(EVENTS.CLIENT.GET_ROOM_LIST, () => {
    const roomList = Object.keys(rooms).map((key) => {
      return {
        roomID: key,
        linkID: rooms[key].inviteLinks[0].linkID,
        roomName: rooms[key].name,
        totalMembers: rooms[key].totalMembers,
      };
    });

    socket.emit(EVENTS.SERVER.SEND_ROOM_LIST, { roomList });
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
