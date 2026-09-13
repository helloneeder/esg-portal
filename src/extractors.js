import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const xlsx = require("xlsx");
const { parseOffice } = require("officeparser");

function readFileSafe(p) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

export async function extractTextFromFile(file) {
  const p = file?.path;
  if (!p) return { ok: false, text: "", reason: "missing_path" };

  const buf = readFileSafe(p);
  if (!buf) return { ok: false, text: "", reason: "read_failed" };

  const ext = path.extname(file.originalname || p).toLowerCase();

  // PDF
  if (file.mimetype === "application/pdf" || ext === ".pdf") {
    try {
      const data = await pdfParse(buf);
      return { ok: true, text: data.text || "" };
    } catch (e) {
      return { ok: false, text: "", reason: `pdf_parse_failed:${e?.message || e}` };
    }
  }

  // Excel
  if (
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === ".xls" ||
    ext === ".xlsx"
  ) {
    try {
      const wb = xlsx.read(buf, { type: "buffer" });
      const parts = [];
      for (const name of wb.SheetNames.slice(0, 5)) {
        const ws = wb.Sheets[name];
        const csv = xlsx.utils.sheet_to_csv(ws, { FS: "\t" });
        parts.push(`### Sheet: ${name}\n${csv}`);
      }
      return { ok: true, text: parts.join("\n\n") };
    } catch (e) {
      return { ok: false, text: "", reason: `xlsx_parse_failed:${e?.message || e}` };
    }
  }

  // PPTX / DOCX (officeparser)
  if (ext === ".pptx" || ext === ".docx") {
    try {
      const text = await parseOffice(p);
      return { ok: true, text: text || "" };
    } catch (e) {
      return { ok: false, text: "", reason: `office_parse_failed:${e?.message || e}` };
    }
  }

  return { ok: false, text: "", reason: "unsupported_type" };
}

export async function extractCorpus(files, { maxChars = 20000 } = {}) {
  const chunks = [];
  for (const f of files || []) {
    const r = await extractTextFromFile(f);
    if (r.ok && r.text && r.text.trim()) {
      chunks.push(`【文件】${f.originalname}\n${r.text}`);
    }
  }

  const joined = chunks.join("\n\n");
  if (joined.length <= maxChars) return joined;
  return joined.slice(0, maxChars) + "\n\n（已截断：文本过长）";
}
