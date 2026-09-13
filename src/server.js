import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { execFile } from "node:child_process";

import { openDb } from "./db.js";
import { makeOpenClawClient } from "./openclawClient.js";
import { buildEsgPrompt } from "./esgPrompt.js";
import { extractCorpus } from "./extractors.js";
import { ensureDir, newId, buildReportPath, requireAdmin } from "./utils.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, "uploads");
const REPORT_DIR = process.env.REPORT_DIR || path.join(DATA_DIR, "reports");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const NOTIFY_TOKEN = process.env.NOTIFY_TOKEN || "";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

// Optional: notify you when a new submission arrives (recommended: Telegram)
const NOTIFY_ENABLED = (process.env.NOTIFY_ENABLED || "").toLowerCase() === "1" || (process.env.NOTIFY_ENABLED || "").toLowerCase() === "true";
const NOTIFY_CHANNEL = process.env.NOTIFY_CHANNEL || "telegram";
const NOTIFY_TARGET = process.env.NOTIFY_TARGET || ""; // Telegram chat id (e.g., 6066563280) or @username

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || "http://127.0.0.1:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || "";
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || "main";
const OPENCLAW_MODEL = process.env.OPENCLAW_MODEL || "openclaw";

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);
ensureDir(REPORT_DIR);

const db = openDb(DATA_DIR);
const llm = makeOpenClawClient({ baseUrl: OPENCLAW_BASE_URL, token: OPENCLAW_TOKEN, agentId: OPENCLAW_AGENT_ID, model: OPENCLAW_MODEL });

function notifyNewSubmission({ companyName, id }) {
  if (!NOTIFY_ENABLED) return;
  if (!NOTIFY_TARGET) return;

  const text = [
    "[ESG问卷] 收到新提交",
    `公司：${companyName}`,
    `编号：${id}`,
    "提示：请你确认资料无误后，再生成报告。",
  ].join("\n");

  // Fire-and-forget; do not block submit response.
  execFile(
    "openclaw",
    ["message", "send", "--channel", NOTIFY_CHANNEL, "--target", NOTIFY_TARGET, "--message", text],
    { timeout: 15_000 },
    () => {}
  );
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = newId();
    const ext = path.extname(file.originalname || "").slice(0, 10);
    cb(null, `${Date.now()}_${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ok = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // docx (optional)
    ].includes(file.mimetype);
    if (!ok) return cb(new Error("只支持PDF/Excel/PPTX（可选DOCX）"));
    cb(null, true);
  },
});

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(process.cwd(), "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

// Minimal polling endpoint for notifications (query-token only; do not expose admin token)
app.get("/api/notify/latest", (req, res) => {
  const t = String(req.query.token || "");
  if (!NOTIFY_TOKEN || t !== NOTIFY_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const row = db.prepare("SELECT id, createdAt, companyName FROM submissions ORDER BY createdAt DESC LIMIT 1").get();
  if (!row) return res.json({ ok: true, latest: null });
  return res.json({ ok: true, latest: row });
});

app.post("/api/submit", upload.array("files", 5), async (req, res, next) => {
  try {
    const token = (req.body.token || "").trim();
    if (!token) throw new Error("缺少链接令牌，请使用我们提供的专属链接填写");

    const linkRow = db.prepare("SELECT * FROM access_links WHERE token=?").get(token);
    if (!linkRow) throw new Error("链接无效或已失效");
    if (linkRow.expiresAt && Date.now() > linkRow.expiresAt) throw new Error("链接已过期");
    if (linkRow.usedCount >= linkRow.maxSubmissions) throw new Error("链接已达到提交次数上限");

    const id = newId();
    const createdAt = Date.now();

    const files = (req.files || []).map((f) => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      path: f.path,
    }));

    const submission = {
      id,
      createdAt,
      companyName: req.body.companyName || "",
      contactName: req.body.contactName || "",
      contactEmail: req.body.contactEmail || "",
      industry: req.body.industry || "",
      region: req.body.region || "",
      employeesRange: req.body.employeesRange || "",
      revenueRange: req.body.revenueRange || "",
      listingStatus: req.body.listingStatus || "",

      // 二、服务项目与 ESG 价值
      serviceTypes: req.body.serviceTypes || "",
      activeProjectsCount: req.body.activeProjectsCount ? Number(req.body.activeProjectsCount) : null,
      postsCount: req.body.postsCount ? Number(req.body.postsCount) : null,
      clientIndustries: req.body.clientIndustries || "",
      highRiskScenarios: req.body.highRiskScenarios || "",
      avgResponseMinutes: req.body.avgResponseMinutes ? Number(req.body.avgResponseMinutes) : null,
      majorIncidentsHandled: req.body.majorIncidentsHandled ? Number(req.body.majorIncidentsHandled) : null,
      clientSatisfaction: req.body.clientSatisfaction || "",
      complaintsOrDisputes: req.body.complaintsOrDisputes || "",

      // 三、项目级填写（p1, p2, p3）
      p1_name: req.body.p1_name || "",
      p1_scene: req.body.p1_scene || "",
      p1_services: req.body.p1_services || "",
      p1_posts: req.body.p1_posts ? Number(req.body.p1_posts) : null,
      p1_respMin: req.body.p1_respMin ? Number(req.body.p1_respMin) : null,
      p1_patrolFreq: req.body.p1_patrolFreq || "",
      p1_events: req.body.p1_events || "",
      p1_sat: req.body.p1_sat || "",
      p1_highlights: req.body.p1_highlights || "",

      p2_name: req.body.p2_name || "",
      p2_scene: req.body.p2_scene || "",
      p2_services: req.body.p2_services || "",
      p2_posts: req.body.p2_posts ? Number(req.body.p2_posts) : null,
      p2_respMin: req.body.p2_respMin ? Number(req.body.p2_respMin) : null,
      p2_patrolFreq: req.body.p2_patrolFreq || "",
      p2_events: req.body.p2_events || "",
      p2_sat: req.body.p2_sat || "",
      p2_highlights: req.body.p2_highlights || "",

      p3_name: req.body.p3_name || "",
      p3_scene: req.body.p3_scene || "",
      p3_services: req.body.p3_services || "",
      p3_posts: req.body.p3_posts ? Number(req.body.p3_posts) : null,
      p3_respMin: req.body.p3_respMin ? Number(req.body.p3_respMin) : null,
      p3_patrolFreq: req.body.p3_patrolFreq || "",
      p3_events: req.body.p3_events || "",
      p3_sat: req.body.p3_sat || "",
      p3_highlights: req.body.p3_highlights || "",

      serviceCases: req.body.serviceCases || "",

      // 四、人员与职业健康安全（S）
      frontlineGuardsCount: req.body.frontlineGuardsCount ? Number(req.body.frontlineGuardsCount) : null,
      managementStaffCount: req.body.managementStaffCount ? Number(req.body.managementStaffCount) : null,
      licensedCoveragePercent: req.body.licensedCoveragePercent ? Number(req.body.licensedCoveragePercent) : null,
      trainingHoursPerCapita: req.body.trainingHoursPerCapita ? Number(req.body.trainingHoursPerCapita) : null,
      workInjuriesCount: req.body.workInjuriesCount ? Number(req.body.workInjuriesCount) : null,
      lostDaysCount: req.body.lostDaysCount ? Number(req.body.lostDaysCount) : null,
      ohsSystem: req.body.ohsSystem || "",
      employeeWelfare: req.body.employeeWelfare || "",

      // 环境（E）数据
      energyKwhPerYear: req.body.energyKwhPerYear ? Number(req.body.energyKwhPerYear) : null,
      renewablePercent: req.body.renewablePercent ? Number(req.body.renewablePercent) : null,
      scope1Known: req.body.scope1Known === "yes" ? 1 : 0,
      scope2Known: req.body.scope2Known === "yes" ? 1 : 0,
      scope3Known: req.body.scope3Known === "yes" ? 1 : 0,
      waterM3PerYear: req.body.waterM3PerYear ? Number(req.body.waterM3PerYear) : null,
      wasteTonPerYear: req.body.wasteTonPerYear ? Number(req.body.wasteTonPerYear) : null,

      // 治理（G）与其他信息
      governancePolicies: req.body.governancePolicies || "",
      complianceIssues: req.body.complianceIssues || "",
      esgGoals: req.body.esgGoals || "",
      notes: req.body.notes || "",

      uploadedFilesJson: JSON.stringify(files),
      aiCompanyType: null,
      aiDataQuality: null,
      reportPath: null,
      reportMarkdown: null,
    };

    if (!submission.companyName) throw new Error("公司名称必填");

    db.prepare(`
      INSERT INTO submissions (
        id, createdAt, companyName, contactName, contactEmail, industry, region,
        employeesRange, revenueRange, listingStatus,
        serviceTypes, activeProjectsCount, postsCount, clientIndustries, highRiskScenarios,
        avgResponseMinutes, majorIncidentsHandled, clientSatisfaction, complaintsOrDisputes,
        p1_name, p1_scene, p1_services, p1_posts, p1_respMin, p1_patrolFreq, p1_events, p1_sat, p1_highlights,
        p2_name, p2_scene, p2_services, p2_posts, p2_respMin, p2_patrolFreq, p2_events, p2_sat, p2_highlights,
        p3_name, p3_scene, p3_services, p3_posts, p3_respMin, p3_patrolFreq, p3_events, p3_sat, p3_highlights,
        serviceCases,
        frontlineGuardsCount, managementStaffCount, licensedCoveragePercent, trainingHoursPerCapita,
        workInjuriesCount, lostDaysCount, ohsSystem, employeeWelfare,
        energyKwhPerYear, renewablePercent, scope1Known, scope2Known, scope3Known,
        waterM3PerYear, wasteTonPerYear,
        governancePolicies, complianceIssues, esgGoals, notes,
        uploadedFilesJson
      ) VALUES (
        @id, @createdAt, @companyName, @contactName, @contactEmail, @industry, @region,
        @employeesRange, @revenueRange, @listingStatus,
        @serviceTypes, @activeProjectsCount, @postsCount, @clientIndustries, @highRiskScenarios,
        @avgResponseMinutes, @majorIncidentsHandled, @clientSatisfaction, @complaintsOrDisputes,
        @p1_name, @p1_scene, @p1_services, @p1_posts, @p1_respMin, @p1_patrolFreq, @p1_events, @p1_sat, @p1_highlights,
        @p2_name, @p2_scene, @p2_services, @p2_posts, @p2_respMin, @p2_patrolFreq, @p2_events, @p2_sat, @p2_highlights,
        @p3_name, @p3_scene, @p3_services, @p3_posts, @p3_respMin, @p3_patrolFreq, @p3_events, @p3_sat, @p3_highlights,
        @serviceCases,
        @frontlineGuardsCount, @managementStaffCount, @licensedCoveragePercent, @trainingHoursPerCapita,
        @workInjuriesCount, @lostDaysCount, @ohsSystem, @employeeWelfare,
        @energyKwhPerYear, @renewablePercent, @scope1Known, @scope2Known, @scope3Known,
        @waterM3PerYear, @wasteTonPerYear,
        @governancePolicies, @complianceIssues, @esgGoals, @notes,
        @uploadedFilesJson
      )
    `).run(submission);

    db.prepare("UPDATE access_links SET usedCount = usedCount + 1 WHERE token=?").run(token);

    notifyNewSubmission({ companyName: submission.companyName, id });

    res.json({ ok: true, id });
  } catch (e) {
    next(e);
  }
});

app.post("/api/admin/generate/:id", async (req, res, next) => {
  try {
    requireAdmin(req, ADMIN_TOKEN);

    const id = req.params.id;
    const row = db.prepare("SELECT * FROM submissions WHERE id=?").get(id);
    if (!row) throw new Error("Not found");

    const files = JSON.parse(row.uploadedFilesJson || "[]");
    const attachmentsText = await extractCorpus(files, { maxChars: 20000 });

    const prompt = buildEsgPrompt(row, { attachmentsText });
    const content = await llm.chat({
      messages: [
        { role: "system", content: "你是严谨的ESG报告撰写助手。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 5000,
    });

    // Extract meta lines if present
    let aiCompanyType = null;
    let aiDataQuality = null;
    const firstLines = content.split("\n").slice(0, 20).join("\n");
    const m1 = firstLines.match(/公司类型判断[:：]\s*(.+)/);
    if (m1) aiCompanyType = m1[1].trim();
    const m2 = firstLines.match(/数据质量评级[:：]\s*(.+)/);
    if (m2) aiDataQuality = m2[1].trim();

    const reportPath = buildReportPath({ reportDir: REPORT_DIR, companyName: row.companyName, createdAt: row.createdAt });
    fs.writeFileSync(reportPath, content, "utf-8");

    db.prepare("UPDATE submissions SET aiCompanyType=?, aiDataQuality=?, reportPath=?, reportMarkdown=? WHERE id=?")
      .run(aiCompanyType, aiDataQuality, reportPath, content, id);

    res.json({ ok: true, reportPath, aiCompanyType, aiDataQuality });
  } catch (e) {
    next(e);
  }
});

app.post("/api/admin/links", (req, res, next) => {
  try {
    requireAdmin(req, ADMIN_TOKEN);

    const token = newId();
    const createdAt = Date.now();

    const maxSubmissions = req.body?.maxSubmissions ? Number(req.body.maxSubmissions) : 3;
    const expiresHours = req.body?.expiresHours ? Number(req.body.expiresHours) : 168; // default 7 days
    const label = req.body?.label ? String(req.body.label) : "";

    const expiresAt = expiresHours > 0 ? createdAt + expiresHours * 3600 * 1000 : null;

    db.prepare("INSERT INTO access_links (token, createdAt, expiresAt, maxSubmissions, label) VALUES (?, ?, ?, ?, ?)")
      .run(token, createdAt, expiresAt, maxSubmissions, label);

    const url = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/?t=${token}`;
    res.json({ ok: true, token, url, expiresAt, maxSubmissions, label });
  } catch (e) {
    next(e);
  }
});

app.get("/api/admin/submissions", (req, res, next) => {
  try {
    requireAdmin(req, ADMIN_TOKEN);
    const rows = db.prepare("SELECT id, createdAt, companyName, industry, region, aiCompanyType, aiDataQuality, reportPath FROM submissions ORDER BY createdAt DESC LIMIT 200").all();
    res.json({ ok: true, rows });
  } catch (e) {
    next(e);
  }
});

app.get("/api/admin/submission/:id", (req, res, next) => {
  try {
    requireAdmin(req, ADMIN_TOKEN);
    const row = db.prepare("SELECT * FROM submissions WHERE id=?").get(req.params.id);
    if (!row) throw new Error("Not found");
    res.json({ ok: true, row });
  } catch (e) {
    next(e);
  }
});

app.use((err, req, res, next) => {
  const status = err.status || 400;
  res.status(status).json({ ok: false, error: err.message || String(err) });
});

const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`ESG portal running on http://127.0.0.1:${PORT}`);
});
