import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "esg.db");
  const db = new Database(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS access_links (
      token TEXT PRIMARY KEY,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER,
      maxSubmissions INTEGER NOT NULL,
      usedCount INTEGER NOT NULL DEFAULT 0,
      label TEXT
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      createdAt INTEGER NOT NULL,
      companyName TEXT NOT NULL,
      contactName TEXT,
      contactEmail TEXT,
      industry TEXT,
      region TEXT,
      employeesRange TEXT,
      revenueRange TEXT,
      listingStatus TEXT,

      -- 二、服务项目与 ESG 价值
      serviceTypes TEXT,
      activeProjectsCount INTEGER,
      postsCount INTEGER,
      clientIndustries TEXT,
      highRiskScenarios TEXT,
      avgResponseMinutes REAL,
      majorIncidentsHandled INTEGER,
      clientSatisfaction TEXT,
      complaintsOrDisputes TEXT,

      -- 三、项目级填写（p1, p2, p3）
      p1_name TEXT,
      p1_scene TEXT,
      p1_services TEXT,
      p1_posts INTEGER,
      p1_respMin REAL,
      p1_patrolFreq TEXT,
      p1_events TEXT,
      p1_sat TEXT,
      p1_highlights TEXT,

      p2_name TEXT,
      p2_scene TEXT,
      p2_services TEXT,
      p2_posts INTEGER,
      p2_respMin REAL,
      p2_patrolFreq TEXT,
      p2_events TEXT,
      p2_sat TEXT,
      p2_highlights TEXT,

      p3_name TEXT,
      p3_scene TEXT,
      p3_services TEXT,
      p3_posts INTEGER,
      p3_respMin REAL,
      p3_patrolFreq TEXT,
      p3_events TEXT,
      p3_sat TEXT,
      p3_highlights TEXT,

      serviceCases TEXT,

      -- 四、人员与职业健康安全（S）
      frontlineGuardsCount INTEGER,
      managementStaffCount INTEGER,
      licensedCoveragePercent REAL,
      trainingHoursPerCapita REAL,
      workInjuriesCount INTEGER,
      lostDaysCount INTEGER,
      ohsSystem TEXT,
      employeeWelfare TEXT,

      -- 环境（E）数据
      energyKwhPerYear REAL,
      renewablePercent REAL,
      scope1Known INTEGER,
      scope2Known INTEGER,
      scope3Known INTEGER,
      waterM3PerYear REAL,
      wasteTonPerYear REAL,

      -- 治理（G）与其他信息
      governancePolicies TEXT,
      complianceIssues TEXT,
      esgGoals TEXT,
      notes TEXT,

      uploadedFilesJson TEXT NOT NULL,
      aiCompanyType TEXT,
      aiDataQuality TEXT,
      reportPath TEXT,
      reportMarkdown TEXT
    );
  `);

  return db;
}
