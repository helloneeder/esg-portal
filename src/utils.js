import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function newId() {
  return crypto.randomBytes(16).toString("hex");
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

export function safeFilename(name) {
  return String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "untitled";
}

export function yyyymmdd(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildReportPath({ reportDir, companyName, createdAt }) {
  const date = yyyymmdd(createdAt);
  const base = `${safeFilename(companyName)}_${date}_ESG报告_v1.md`;
  return path.join(reportDir, base);
}

export function requireAdmin(req, adminToken) {
  if (!adminToken) return; // if not set, do not restrict
  const got = req.headers["x-admin-token"] || req.query.adminToken;
  if (got !== adminToken) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}
