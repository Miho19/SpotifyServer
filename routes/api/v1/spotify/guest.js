import express from "express";
import { faker } from "@faker-js/faker";
import { guestSpotifyApi, guestToken } from "../../../../util/spotify.js";

export const guestRouter = express.Router();

const getGuestName = (req, res) => {
  const email = faker.internet.email();
  const image =
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThJsnCpWap9mbJS3iyfeb6SrYbuEz9De3xJQ&usqp=CAU";

  const user = {
    email: email,
    image: image,
    type: "guest",
    access_token: guestToken.access_token,
    expires_at: guestToken.expires_at,
  };

  return res.status(200).json({ success: true, data: [user] });
};

guestRouter.get("/", getGuestName);
