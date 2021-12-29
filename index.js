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
const PLAYLISTID = "1qzGPv5E2rf7KIeE9wN27Y";

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
    GET_ROOM_PLAYLISTID: "GET_ROOM_PLAYLISTID",
    GET_CURRENT_ROOM: "GET_CURRENT_ROOM",
  },
  SERVER: {
    CLIENT_JOINED_ROOM: "CLIENT_JOINED_ROOM",
    CLIENT_LEFT_ROOM: "CLIENT_LEFT_ROOM",
    EMIT_MESSAGE: "EMIT_MESSAGE",
    ROOM_MEMBERS_CHANGED: "ROOM_MEMBERS_CHANGED",
  },
};

const rooms = {
  1: {
    name: "Party House #1",
    totalMembers: 0,
    members: new Set(),
    playlistID: PLAYLISTID,
    inviteLinks: [
      {
        linkID: uuid(),
        timeExpire: new Dayjs("2100-12-24T08:17:55+0000"),
      },
    ],
  },
};

const inviteLinkToRoomKey = {};

const generateInviteToRoomKey = () => {
  let numOfLinks = 0;

  Object.keys(rooms).forEach((roomID) => {
    rooms[roomID].inviteLinks.forEach((link) => {
      inviteLinkToRoomKey[link.linkID] = {
        roomID: roomID,
      };
      numOfLinks++;
    });
  });

  return numOfLinks;
};

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
  console.log(`Server Listening ${HOST}::${PORT}`);

  console.log(
    `Generating permanant links to room keys: ${generateInviteToRoomKey()}`
  );
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

    const roomMembers = [...rooms[String(roomID)].members];

    socket
      .to(String(roomID))
      .emit(EVENTS.SERVER.ROOM_MEMBERS_CHANGED, { roomMembers: roomMembers });
  });

  socket.on(EVENTS.CLIENT.LEAVE_ROOM, () => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name);

    const roomMembers = [...rooms[String(currentRoomID)].members];

    socket
      .to(String(currentRoomID))
      .emit(EVENTS.SERVER.ROOM_MEMBERS_CHANGED, { roomMembers: roomMembers });

    socket.leave(currentRoomID);
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

  socket.on(EVENTS.CLIENT.GET_ROOM_LIST, (callback) => {
    const roomList = Object.keys(rooms).map((key) => {
      return {
        roomID: key,
        linkID: rooms[key].inviteLinks[0].linkID,
        roomName: rooms[key].name,
        totalMembers: rooms[key].totalMembers,
      };
    });

    callback({ roomList });
  });

  socket.on(EVENTS.CLIENT.GET_ROOM_MEMBERS, (callback) => {
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    const roomMembers = [...rooms[String(currentRoomID)].members];
    callback({ roomMembers: roomMembers });
  });

  socket.on(EVENTS.CLIENT.SET_USER_PROFILE, ({ name, imgSource, email }) => {
    socket.data.user = { name, imgSource, email };
  });

  socket.on(EVENTS.CLIENT.GET_ROOM_PLAYLISTID, (callback) => {
    if (!callback) return;
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    const playlistID = rooms[String(currentRoomID)].playlistID;

    callback({ playlistID });
  });

  socket.on(EVENTS.CLIENT.GET_CURRENT_ROOM, (callback) => {
    if (!callback) return;
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    const currentRoomName = rooms[currentRoomID].name;
    callback({ roomID: currentRoomID, roomName: currentRoomName });
  });
});
