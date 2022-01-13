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
    : "https://spotify-client-blue.vercel.app/";
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
    GET_CURRENT_ROOM: "GET_CURRENT_ROOM",
    CHANGED_PARTYPLAYLIST: "CHANGED_PARTYPLAYLIST",
    HOST_CHANGE_SONG: "HOST_CHANGE_SONG",
    TOGGLE_PLAYBACK: "TOGGLE_PLAYBACK",
  },
  SERVER: {
    CLIENT_TOGGLED_PLAYBACK: "CLIENT_TOGGLED_PLAYBACK",
    CLIENT_JOINED_ROOM: "CLIENT_JOINED_ROOM",
    CLIENT_LEFT_ROOM: "CLIENT_LEFT_ROOM",
    EMIT_MESSAGE: "EMIT_MESSAGE",
    ROOM_MEMBERS_CHANGED: "ROOM_MEMBERS_CHANGED",
    ROOM_PLAYLIST_CHANGED: "ROOM_PLAYLIST_CHANGED",
    ROOM_PLAYLIST_SONG_CHANGED: "ROOM_PLAYLIST_SONG_CHANGED",
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

  socket.on(EVENTS.CLIENT.TOGGLE_PLAYBACK, ({ left }) => {
    if (socket.rooms.size !== 1) {
      const currentRoomID = [...socket.rooms][1];

      const host = io.sockets.sockets.get(rooms[currentRoomID].host.socket_id);

      host.emit(EVENTS.SERVER.HOST_GET_SONG, ({ uri, progress, timestamp }) => {
        socket.emit(EVENTS.SERVER.CLIENT_TOGGLED_PLAYBACK, {
          left,
          uri,
          progress,
        });
      });

      return;
    }

    socket.emit(EVENTS.SERVER.CLIENT_TOGGLED_PLAYBACK, { left });
  });

  socket.on(EVENTS.CLIENT.HOST_CHANGE_SONG, () => {
    const currentRoomID = [...socket.rooms][1];

    socket.emit(EVENTS.SERVER.HOST_GET_SONG, ({ uri, progress, timestamp }) => {
      io.to(currentRoomID).emit(EVENTS.SERVER.ROOM_PLAYLIST_SONG_CHANGED, {
        uri: uri,
        progress: progress,
      });
    });
  });

  socket.on(EVENTS.CLIENT.CHANGED_PARTYPLAYLIST, () => {
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    io.to(currentRoomID).emit(EVENTS.SERVER.ROOM_PLAYLIST_CHANGED);
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

    if (rooms[roomID].totalMembers === 1) {
      rooms[roomID].host.socket_id = socket.id;

      socket.emit(
        EVENTS.SERVER.HOST_INIT,
        {
          playlistID: rooms[roomID].playlist.playlistID,
        },
        ({ playlistID, snapshotID }) => {
          if (playlistID !== rooms[roomID].playlist.playlistID) return;

          rooms[roomID].playlist.snapshotID = snapshotID;
        }
      );

      socket.data.user.host = true;
    }

    socket.emit(EVENTS.SERVER.CLIENT_JOINED_ROOM, {
      roomID: roomID,
      roomName: rooms[roomID].name,
      playlist: rooms[roomID].playlist,
    });

    const host = io.sockets.sockets.get(rooms[roomID].host.socket_id);

    if (socket.id !== host.id) {
      host.emit(EVENTS.SERVER.HOST_GET_SONG, ({ uri, progress, timestamp }) => {
        socket.emit(EVENTS.SERVER.ROOM_PLAYLIST_SONG_CHANGED, {
          uri: uri,
          progress: progress,
        });
      });
    }

    const roomMembers = [...rooms[String(roomID)].members];

    socket
      .to(String(roomID))
      .emit(EVENTS.SERVER.ROOM_MEMBERS_CHANGED, { roomMembers: roomMembers });
  });

  socket.on(EVENTS.CLIENT.LEAVE_ROOM, async () => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name);

    const roomMembers = [...rooms[String(currentRoomID)].members];

    const host = rooms[currentRoomID].host.socket_id;

    if (host === socket.id) {
      rooms[currentRoomID].host.socket_id = "";

      if (roomMembers.length >= 1) {
        const ids = await io.in(currentRoomID).allSockets();
        rooms[currentRoomID].host.socket_id = [...ids][1]; // not done, need to now redo host init
      }
    }

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
