import express from "express";
import { rooms } from "../../../socket/spotify/spotifyRooms.js";

export const roomsRouter = express.Router();

/**
 * Route for /api/spotify/room/
 *
 */

const getRooms = (req, res) => {
  let newRooms = [];

  Object.keys(rooms).forEach((roomID) => {
    const room = rooms[roomID];

    const memberList = [...room.members].map((member) => {
      member.name, timeJoined;
    });

    const roomData = {
      name: room.name,
      members: room.totalMembers,
      playlistID: room.playlist.playlistID,
      memberList: memberList,
    };

    newRooms.push(roomData);
  });

  res.status(200).json({ success: true, data: [{ roomList: newRooms }] });
};

const getRoom = (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ success: false, data: [] });

  const room = rooms[String(id)];

  if (!room) return res.status(404).json({ success: false, data: [] });

  const memberList = [...room.members].map((member) => {
    return {
      uesrName: member.name,
    };
  });

  const roomData = {
    name: room.name,
    members: room.totalMembers,
    playlist: room.playlist.playlistID,
    hostID: room.host.socket_id,
    links: room.inviteLinks.length,
    memberList: memberList,
  };

  res.status(202).json({ success: true, data: [roomData] });
};

const getMembers = (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, data: [] });

  const room = rooms[String(id)];

  if (!room) return res.status(404).json({ success: false, data: [] });

  const memberList = [...room.members].map((member) => {
    return {
      uesrName: member.name,
    };
  });

  return res.status(202).json({ success: true, data: memberList });
};

roomsRouter.get("/", getRooms);
roomsRouter.get("/:id", getRoom);
roomsRouter.get("/:id/members", getMembers);
