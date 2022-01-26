import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { v4 as uuid } from "uuid";

import Dayjs from "dayjs";

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 4000;
const HOST = "localhost";
const CORSORIGIN =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://spotify-client-blue.vercel.app";
const PLAYLISTID = "1qzGPv5E2rf7KIeE9wN27Y";

const EVENTS = {
  connection: "connection",
  disconnect: "disconnect",
  CLIENT: {
    SET_USER_PROFILE: "SET_USER_PROFILE",
    JOIN_ROOM: "JOIN_ROOM",
    LEAVE_ROOM: "LEAVE_ROOM",
    SEND_MESSAGE: "SEND_MESSAGE",
    GET_ROOM_MEMBERS: "GET_ROOM_MEMBERS",
    GET_ROOM_LIST: "GET_ROOM_LIST",
    GET_CURRENT_ROOM: "GET_CURRENT_ROOM",
    UPDATE_PLAYLIST: "CHANGED_PARTYPLAYLIST",
    HOST_CHANGE_SONG: "HOST_CHANGE_SONG",
  },
  SERVER: {
    CLIENT_JOINED_ROOM: "CLIENT_JOINED_ROOM",
    CLIENT_LEFT_ROOM: "CLIENT_LEFT_ROOM",
    EMIT_MESSAGE: "EMIT_MESSAGE",
    ROOM_MEMBERS_CHANGED: "ROOM_MEMBERS_CHANGED",
    PLAYLIST_UPDATED: "ROOM_PLAYLIST_CHANGED",
    CURRENT_SONG_CHANGED: "ROOM_PLAYLIST_SONG_CHANGED",
    HOST_GET_SONG: "HOST_GET_SONG",
    HOST_INIT: "HOST_INIT",
  },
};

const rooms = {
  1: {
    name: "Party House #1",
    totalMembers: 0,
    members: new Set(),
    playlist: {
      playlistID: PLAYLISTID,
      snapshotID: "",
    },

    host: {
      socket_id: "",
    },
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
  res.send("successfull");
});

httpServer.listen(PORT, () => {
  console.log(`Server Listening ${PORT}`);

  console.log(
    `Generating permanant links to room keys: ${generateInviteToRoomKey()}`
  );
});

const newHostInit = (newHostSocket, roomID) => {
  if (!newHostSocket || !roomID) return;

  const setRoomPlaylist = ({ playlistID, snapshotID }) => {
    rooms[roomID].playlist.snapshotID = snapshotID;
  };

  const playlistID = rooms[String(roomID)].playlist.playlistID;

  newHostSocket.emit(EVENTS.SERVER.HOST_INIT, { playlistID }, setRoomPlaylist);

  rooms[roomID].host.socket_id = newHostSocket.id;
  newHostSocket.data.user.host = true;
};

const removeMember = async (currentRoomID, userName, socket_id) => {
  if (!userName) return;
  if (!rooms[currentRoomID]) return;

  rooms[String(currentRoomID)].totalMembers -= 1;

  const newRoomMembers = [...rooms[String(currentRoomID)].members].filter(
    (member) => member.socketID !== socket_id
  );

  rooms[String(currentRoomID)].members = newRoomMembers
    ? new Set(newRoomMembers)
    : new Set();

  const hostID = rooms[currentRoomID].host.socket_id;

  if (socket_id !== hostID) return;
  rooms[currentRoomID].host.socket_id = "";
  console.log("removing host:", rooms[currentRoomID].host.socket_id);

  if (rooms[String(currentRoomID)].members.length < 1) return;

  const ids = await io.in(currentRoomID).allSockets();

  let newHostID = "";

  [...ids].forEach((id) => {
    if (newHostID === "" && socket_id !== id) {
      newHostID = id;
    }
  });

  rooms[currentRoomID].host.socket_id = newHostID;
  const newHost = io.sockets.sockets.get(newHostID);

  newHostInit(newHost, currentRoomID);
};

io.on("connection", (socket) => {
  console.log(`socket user: ${socket.id} connected`);

  socket.on(EVENTS.disconnect, () => {
    console.log("user disconeccted");
  });

  socket.on("disconnecting", (reason) => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name, socket.id);
  });

  socket.on(EVENTS.CLIENT.HOST_CHANGE_SONG, () => {
    const currentRoomID = [...socket.rooms][1];

    socket.emit(EVENTS.SERVER.HOST_GET_SONG, ({ uri, progress, timestamp }) => {
      io.to(currentRoomID).emit(EVENTS.SERVER.CURRENT_SONG_CHANGED, {
        uri: uri,
        progress: progress,
      });
    });
  });

  socket.on(EVENTS.CLIENT.UPDATE_PLAYLIST, () => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    io.to(currentRoomID).emit(EVENTS.SERVER.PLAYLIST_UPDATED);
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
      return;
    }

    const query = inviteLinkToRoomKey[joinLink];
    if (!query) return;

    const roomID = query.roomID;

    socket.join(roomID);

    rooms[roomID].totalMembers += 1;
    rooms[roomID].members.add({
      socketID: socket.id,
      name: socket.data.user.name,
      imgSource: socket.data.user.imgSource,
      timeJoined: time,
    });

    if (rooms[roomID].host.socket_id === "") {
      newHostInit(socket, roomID);
    }

    socket.emit(EVENTS.SERVER.CLIENT_JOINED_ROOM, {
      roomID: roomID,
      roomName: rooms[roomID].name,
      playlist: rooms[roomID].playlist,
    });

    const roomMembers = [...rooms[String(roomID)].members];

    socket
      .to(String(roomID))
      .emit(EVENTS.SERVER.ROOM_MEMBERS_CHANGED, { roomMembers: roomMembers });

    const host = io.sockets.sockets.get(rooms[roomID].host.socket_id);

    if (host && host.id === socket.id) return;

    host.emit(EVENTS.SERVER.HOST_GET_SONG, ({ uri, progress, timestamp }) => {
      socket.emit(EVENTS.SERVER.CURRENT_SONG_CHANGED, {
        uri: uri,
        progress: progress,
      });
    });
  });

  socket.on(EVENTS.CLIENT.LEAVE_ROOM, () => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name, socket.id);

    const roomMembers = [...rooms[String(currentRoomID)].members];

    io.to(String(currentRoomID)).emit(EVENTS.SERVER.ROOM_MEMBERS_CHANGED, {
      roomMembers: roomMembers,
    });

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

  socket.on(
    EVENTS.CLIENT.SET_USER_PROFILE,
    ({ name, imgSource, email, host }) => {
      socket.data.user = { name, imgSource, email, host };
    }
  );

  socket.on(EVENTS.CLIENT.GET_ROOM_PLAYLISTID, (callback) => {
    if (!callback) return;
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    const { playlistID, snapshotID } = rooms[String(currentRoomID)].playlist;

    callback({ playlistID, snapshotID });
  });

  socket.on(EVENTS.CLIENT.GET_CURRENT_ROOM, (callback) => {
    if (!callback) return;
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    const currentRoomName = rooms[currentRoomID].name;
    const playlist = rooms[currentRoomID].playlist;

    callback({
      roomID: currentRoomID,
      roomName: currentRoomName,
      playlist: playlist,
    });
  });
});
