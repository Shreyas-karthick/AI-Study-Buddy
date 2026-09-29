const jwt = require("jsonwebtoken");

const getAccessSecret = () =>
  process.env.JWT_ACCESS_SECRET && !process.env.JWT_ACCESS_SECRET.startsWith("<")
    ? process.env.JWT_ACCESS_SECRET
    : "studybuddy_jwt_access_secret_key_default";

const getRefreshSecret = () =>
  process.env.JWT_REFRESH_SECRET && !process.env.JWT_REFRESH_SECRET.startsWith("<")
    ? process.env.JWT_REFRESH_SECRET
    : "studybuddy_jwt_refresh_secret_key_default";

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    getAccessSecret(),
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { userId, role },
    getRefreshSecret(),
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

module.exports = { generateTokens, getAccessSecret, getRefreshSecret };
