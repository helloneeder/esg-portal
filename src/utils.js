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

/**
 * Admin 鉴权中间件（fail-closed 设计）
 * 未配置 ADMIN_TOKEN 时直接拒绝，避免漏配导致裸奔
 * token 仅从 x-admin-token header 读取，不支持 query 参数（防日志泄露）
 */
export function requireAdmin(req, adminToken) {
  if (!adminToken) {
    const err = new Error("Admin token not configured");
    err.status = 500;
    throw err;
  }
  const got = req.headers["x-admin-token"];
  if (!got || got !== adminToken) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}
