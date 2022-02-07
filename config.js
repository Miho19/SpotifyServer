export const PORT = process.env.PORT || 4000;
export const HOST = "localhost";
export const CORSORIGIN =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://spotify-client-blue.vercel.app";
