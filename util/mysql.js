import mysql from "mysql2/promise";

const DATABASE_URL = `mysql://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_REGION}/spotify-friends?ssl={"rejectUnauthorized":true}`;

export const connection = await mysql.createConnection(DATABASE_URL);
