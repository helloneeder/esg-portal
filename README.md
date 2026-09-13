# ESG Portal (MVP)

凌朝智绿 ESG 问卷 + AI 报告生成系统（MVP 版本）。

## 功能

- 客户问卷填写（支持多行业模板）
- 文件上传（PDF / Excel / Word 解析）
- AI 自动生成 ESG 报告（Markdown 格式）
- 管理后台（提交列表、报告预览/编辑、多格式导出）
- 一次性访问链接（access token）

## 技术栈

- **后端**：Node.js + Express 5
- **数据库**：SQLite（better-sqlite3），启动自动建表
- **AI**：通过 OpenClaw Gateway 调用大模型
- **前端**：原生 HTML / CSS / JS（无构建）

## 环境要求

- Node.js >= 18.x
- npm >= 9.x
- OpenClaw Gateway（本地或远程可访问）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 OPENCLAW_TOKEN、ADMIN_TOKEN 等

# 3. 启动
npm start
```

浏览器打开：
- 客户问卷：http://127.0.0.1:3000/
- 管理后台：http://127.0.0.1:3000/admin.html（需 ADMIN_TOKEN）

## 环境变量说明

| 变量 | 说明 | 必填 |
|------|------|------|
| OPENCLAW_BASE_URL | OpenClaw Gateway 地址 | 是 |
| OPENCLAW_TOKEN | Gateway 管理员令牌 | 是 |
| OPENCLAW_AGENT_ID | 调用的 agent id | 否（默认 main） |
| OPENCLAW_MODEL | 使用的模型 | 否（默认 openclaw） |
| OPENCLAW_MODEL | 使用的模型 | 否 |
| DATA_DIR | 数据目录（数据库+上传） | 否（默认 ./data） |
| REPORT_DIR | 报告输出目录 | 是 |
| PORT | 服务端口 | 否（默认 3000） |
| PUBLIC_BASE_URL | 对外访问地址 | 否 |
| ADMIN_TOKEN | 管理后台令牌 | 是 |
| NOTIFY_TOKEN | 通知轮询令牌 | 否 |
| NOTIFY_ENABLED | 是否启用新提交通知 | 否 |
| NOTIFY_CHANNEL | 通知渠道（telegram/feishu） | 否 |
| NOTIFY_TARGET | 通知目标 | 否 |

## 目录结构

```
esg-portal/
├── src/
│   ├── server.js          # Express 主服务
│   ├── db.js              # 数据库操作
│   ├── openclawClient.js  # OpenClaw Gateway 客户端
│   ├── esgPrompt.js       # ESG 报告生成 Prompt
│   ├── extractors.js      # 文件解析（PDF/Excel/Word）
│   └── utils.js           # 工具函数
├── public/
│   ├── index.html         # 客户问卷页
│   ├── admin.html         # 管理后台
│   ├── security.html      # 保安行业问卷模板
│   └── property.html      # 物业行业问卷模板
├── data/                  # 运行时数据（不入库）
│   ├── esg.db             # SQLite 数据库（自动创建）
│   └── uploads/           # 上传文件（自动创建）
├── .env.example
├── package.json
└── README.md
```

## 管理后台 API

```bash
# 查看提交列表
curl -H 'x-admin-token: YOUR_ADMIN_TOKEN' \
  http://127.0.0.1:3000/api/admin/submissions

# 生成报告
curl -X POST -H 'x-admin-token: YOUR_ADMIN_TOKEN' \
  http://127.0.0.1:3000/api/admin/generate/<submissionId>
```

## 部署注意事项

1. **SQLite 持久化**：确保 data/ 目录有持久化存储，定期备份 esg.db
2. **管理后台鉴权**：admin.html 通过 ADMIN_TOKEN 保护，公网部署必须设置强令牌
3. **OpenClaw Gateway**：AI 报告强依赖 Gateway，生产环境需确保 Gateway 稳定运行，考虑高可用方案
4. **文件上传**：上传文件大小限制在 server.js 中配置，注意磁盘空间
5. **HTTPS**：公网部署必须启用 HTTPS

## 已知限制

- 数据库为单文件 SQLite，并发量有限
- 管理后台无细粒度权限控制，仅单 token
- 报告生成为 Markdown，DOCX/PDF 导出需进一步开发
- 无用户注册/登录系统，问卷通过 access token 分发访问
