import EVENTS from "./spotifyEvents.js";

import { newHostInit, removeMember, addMember } from "./spotifyUtil.js";
import { inviteLinkToRoomKey, rooms } from "./spotifyRooms.js";

import Dayjs from "dayjs";
import { v4 as uuid } from "uuid";

export function registerSpotifyHandlers(io, socket) {
  const disconnect = () => {
    console.log("user disconnected");
  };

  const disconnecting = (reason) => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name, socket.id, io);
  };

  const updateRoomSong = () => {
    const currentRoomID = [...socket.rooms][1];
    socket.emit(EVENTS.SERVER.HOST_GET_SONG, ({ uri, progress, timestamp }) => {
      io.to(currentRoomID).emit(EVENTS.SERVER.CURRENT_SONG_CHANGED, {
        uri,
        progress,
      });
    });
  };

  const updateRoomPlaylist = () => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    io.to(currentRoomID).emit(EVENTS.SERVER.PLAYLIST_UPDATED);
  };

  const joinRoom = ({ joinLink }) => {
    if (!joinLink) return;

    const time = Dayjs();

    if (socket.rooms.size > 1) {
      const currentRoomID = [...socket.rooms][1];
      const currentRoomName = rooms[currentRoomID].name;

      socket.emit(EVENTS.SERVER.EMIT_MESSAGE, {
        message: `Leave ${currentRoomName} first.`,
        senderID: "__ADMIN__",
        messagaeID: uuid(),
        time: time,
      });
      return;
    }

    const joinRoom = inviteLinkToRoomKey[joinLink];

    if (!joinRoom) return;

    const roomID = joinRoom.roomID;

    const user = {
      socketID: socket.id,
      name: socket.data.user.name,
      imgSource: socket.data.user.imgSource,
      timeJoined: time,
    };

    addMember(socket, roomID, user);

    socket.emit(EVENTS.SERVER.CLIENT_JOINED_ROOM, {
      roomID: roomID,
      roomName: rooms[roomID].name,
      playlist: rooms[roomID].playlist,
    });

    const roomMembers = [...rooms[String(roomID)].members];

    io.in(roomID).emit(EVENTS.SERVER.ROOM_MEMBERS_CHANGED, {
      roomMembers: roomMembers,
    });

    const host = io.sockets.sockets.get(rooms[roomID].host.socket_id);
    if (!host) return;
    if (host && host.id === socket.id) return;

    host.emit(EVENTS.SERVER.HOST_GET_SONG, ({ uri, progress, timestamp }) => {
      socket.emit(EVENTS.SERVER.CURRENT_SONG_CHANGED, {
        uri: uri,
        progress: progress,
      });
    });
  };

  const leaveRoom = () => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name, socket.id, io);

    const roomMembers = [...rooms[String(currentRoomID)].members];
    io.to(String(currentRoomID)).emit(EVENTS.SERVER.ROOM_MEMBERS_CHANGED, {
      roomMembers: roomMembers,
    });

    socket.leave(currentRoomID);
    socket.emit(EVENTS.SERVER.CLIENT_LEFT_ROOM);
  };

  const sendMessage = ({ message }) => {
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];

    io.to(currentRoomID).emit(EVENTS.SERVER.EMIT_MESSAGE, {
      message: message,
      senderID: socket.id,
      senderName: socket.data.user.name,
      senderImgSource: socket.data.user.imgSource,
      messageID: uuid(),
      time: Dayjs(),
    });
  };

  const getRoomList = (callback) => {
    const roomList = Object.keys(rooms).map((key) => {
      return {
        roomID: key,
        linkID: rooms[key].inviteLinks[0].linkID,
        roomName: rooms[key].name,
        totalMembers: rooms[key].totalMembers,
      };
    });

    callback({ roomList });
  };

  const getRoomMembers = (callback) => {
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    const roomMembers = [...rooms[String(currentRoomID)].members];
    callback({ roomMembers: roomMembers });
  };

  const getRoomPlaylistID = (callback) => {
    if (!callback) return;
    if (socket.rooms.size === 1) return;

    const currentRoomID = [...socket.rooms][1];
    const { playlistID, snapshotID } = rooms[String(currentRoomID)].playlist;

    callback({ playlistID, snapshotID });
  };

  const getCurrentRoom = (callback) => {
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
  };

  const setUserProfile = ({ name, imgSource, email, host }) => {
    socket.data.user = { name, imgSource, email, host };
  };

  socket.on(EVENTS.disconnect, disconnect);
  socket.on(EVENTS.disconnecting, disconnecting);
  socket.on(EVENTS.CLIENT.HOST_CHANGE_SONG, updateRoomSong);
  socket.on(EVENTS.CLIENT.UPDATE_PLAYLIST, updateRoomPlaylist);
  socket.on(EVENTS.CLIENT.JOIN_ROOM, joinRoom);
  socket.on(EVENTS.CLIENT.LEAVE_ROOM, leaveRoom);
  socket.on(EVENTS.CLIENT.SEND_MESSAGE, sendMessage);
  socket.on(EVENTS.CLIENT.GET_ROOM_LIST, getRoomList);
  socket.on(EVENTS.CLIENT.GET_ROOM_MEMBERS, getRoomMembers);
  socket.on(EVENTS.CLIENT.SET_USER_PROFILE, setUserProfile);
  socket.on(EVENTS.CLIENT.GET_ROOM_PLAYLISTID, getRoomPlaylistID);
  socket.on(EVENTS.CLIENT.GET_CURRENT_ROOM, getCurrentRoom);
}
