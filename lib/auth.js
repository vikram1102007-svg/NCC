const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("./db");

const COOKIE_NAME = "ncc_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "test") {
    return "test-only-ephemeral-secret-32-chars-min";
  }
  throw new Error("JWT_SECRET environment variable must be set (minimum 16 characters).");
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(String(plainPassword), 10);
}

async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(String(plainPassword), String(hash || ""));
}

function signSessionToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "7d"
  });
}

function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
}

function isSecureRequest(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  return req.secure || proto === "https" || process.env.NODE_ENV === "production";
}

function setAuthCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
    maxAge: SESSION_MAX_AGE_MS
  });
}

function clearAuthCookie(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/"
  });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    regimentalNo: user.regimentalNo,
    year: user.year,
    department: user.department,
    phone: user.phone,
    email: user.email,
    role: user.role
  };
}

function generateId(prefix = "NCC") {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function generateOpaqueToken() {
  // 16 random bytes (128 bits) hex token — contains zero personal information.
  return `TKN-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
}

async function resolveSessionUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = verifySessionToken(token);
    if (!decoded || !decoded.sub) return null;
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: String(decoded.sub) });
    return user || null;
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const user = await resolveSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "Please log in to continue." });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = req.user || (await resolveSessionUser(req));
    if (!user) {
      return res.status(401).json({ error: "Please log in as an administrator." });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin privileges required." });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  setAuthCookie,
  clearAuthCookie,
  publicUser,
  generateId,
  generateOpaqueToken,
  resolveSessionUser,
  requireAuth,
  requireAdmin
};
