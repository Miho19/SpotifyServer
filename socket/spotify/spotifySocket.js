import EVENTS from "./spotifyEvents.js";

import { removeMember, addMember } from "./spotifyUtil.js";
import { inviteLinkToRoomKey, rooms } from "./spotifyRooms.js";

import Dayjs from "dayjs";
import { v4 as uuid } from "uuid";

import { serverSpotifyApi } from "../../util/spotify.js";

export function registerSpotifyHandlers(io, socket) {
  const disconnect = () => {
    if (!socket.data.user) return;
    console.log(`${socket.data.user.name} disconnected\tid:${socket.id}`);
  };

  const disconnecting = (reason) => {
    if (socket.rooms.size === 1) return;
    const currentRoomID = [...socket.rooms][1];
    removeMember(currentRoomID, socket.data.user.name, socket.id, io);
  };

  const updateRoomSong = () => {
    const currentRoomID = [...socket.rooms][1];
    socket.emit(EVENTS.SERVER.HOST_GET_SONG, ({ id, progress, timestamp }) => {
      io.to(currentRoomID).emit(EVENTS.SERVER.CURRENT_SONG_CHANGED, {
        id,
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

    host.emit(EVENTS.SERVER.HOST_GET_SONG, ({ id, progress, timestamp }) => {
      socket.emit(EVENTS.SERVER.CURRENT_SONG_CHANGED, {
        id,
        progress,
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

  const addSongToRoom = async ({ track, partyPlaylistID }, callback) => {
    if (socket.rooms.size === 1) return;
    if (!serverSpotifyApi.getAccessToken()) return;
    if (!partyPlaylistID) return;

    const currentRoomID = [...socket.rooms][1];

    try {
      const addResponse = await serverSpotifyApi.addTracksToPlaylist(
        partyPlaylistID,
        [track.track.uri]
      );
    } catch (error) {
      console.log(
        `Error ${addResponse.statusCode}: playlist: ${partyPlaylistID} track: ${track.track}`
      );
    }

    callback();
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
  socket.on(EVENTS.CLIENT.ADD_SONG_TO_CURRENT_ROOM, addSongToRoom);
}
