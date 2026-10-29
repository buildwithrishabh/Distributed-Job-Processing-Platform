const jwt = require("jsonwebtoken");
const { ACCESS_TOKEN_SECRET } = require("../config/env");
const User = require("../models/user");

const socketAuthMiddleware = async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    if (!cookieHeader) {
      return next(new Error("Authentication required"));
    }

    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((cookie) => {
        const [key, ...value] = cookie.trim().split("=");
        return [key, decodeURIComponent(value.join("="))];
      }),
    );

    const token = cookies.accessToken;

    if (!token) {
      return next(new Error("Access token missing"));
    }

    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.id).select("_id email name");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;

    next();
  } catch (error) {
    return next(new Error("Unauthorized"));
  }
};

module.exports = socketAuthMiddleware;
