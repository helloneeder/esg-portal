export function buildEsgPrompt(submission, { attachmentsText = "" } = {}) {
  const company = {
    companyName: submission.companyName,
    industry: submission.industry,
    region: submission.region,
    employeesRange: submission.employeesRange,
    revenueRange: submission.revenueRange,
    listingStatus: submission.listingStatus,
  };

  const serviceData = {
    serviceTypes: submission.serviceTypes,
    activeProjectsCount: submission.activeProjectsCount,
    postsCount: submission.postsCount,
    clientIndustries: submission.clientIndustries,
    highRiskScenarios: submission.highRiskScenarios,
    avgResponseMinutes: submission.avgResponseMinutes,
    majorIncidentsHandled: submission.majorIncidentsHandled,
    clientSatisfaction: submission.clientSatisfaction,
    complaintsOrDisputes: submission.complaintsOrDisputes,
  };

  const projectsData = {
    p1: {
      name: submission.p1_name,
      scene: submission.p1_scene,
      services: submission.p1_services,
      posts: submission.p1_posts,
      respMin: submission.p1_respMin,
      patrolFreq: submission.p1_patrolFreq,
      events: submission.p1_events,
      sat: submission.p1_sat,
      highlights: submission.p1_highlights,
    },
    p2: {
      name: submission.p2_name,
      scene: submission.p2_scene,
      services: submission.p2_services,
      posts: submission.p2_posts,
      respMin: submission.p2_respMin,
      patrolFreq: submission.p2_patrolFreq,
      events: submission.p2_events,
      sat: submission.p2_sat,
      highlights: submission.p2_highlights,
    },
    p3: {
      name: submission.p3_name,
      scene: submission.p3_scene,
      services: submission.p3_services,
      posts: submission.p3_posts,
      respMin: submission.p3_respMin,
      patrolFreq: submission.p3_patrolFreq,
      events: submission.p3_events,
      sat: submission.p3_sat,
      highlights: submission.p3_highlights,
    },
    serviceCases: submission.serviceCases,
  };

  const socialData = {
    frontlineGuardsCount: submission.frontlineGuardsCount,
    managementStaffCount: submission.managementStaffCount,
    licensedCoveragePercent: submission.licensedCoveragePercent,
    trainingHoursPerCapita: submission.trainingHoursPerCapita,
    workInjuriesCount: submission.workInjuriesCount,
    lostDaysCount: submission.lostDaysCount,
    ohsSystem: submission.ohsSystem,
    employeeWelfare: submission.employeeWelfare,
  };

  const environmentData = {
    energyKwhPerYear: submission.energyKwhPerYear,
    renewablePercent: submission.renewablePercent,
    scope1Known: submission.scope1Known,
    scope2Known: submission.scope2Known,
    scope3Known: submission.scope3Known,
    waterM3PerYear: submission.waterM3PerYear,
    wasteTonPerYear: submission.wasteTonPerYear,
  };

  const governanceData = {
    governancePolicies: submission.governancePolicies,
    complianceIssues: submission.complianceIssues,
    esgGoals: submission.esgGoals,
    notes: submission.notes,
  };

  const hasAttachments = Boolean(attachmentsText && attachmentsText.trim());

  return (
    `你是一位ESG报告撰写顾问，专注于保安服务/物业安保行业。请根据客户问卷数据，以及客户上传材料的可抽取文本，生成一份“可人工审阅、可修改”的ESG报告（Markdown）。\n\n` +
    `要求：\n` +
    `- 语言：简体中文\n` +
    `- 输出：仅输出Markdown正文，不要输出代码块标记\n` +
    `- 面向保安服务企业：重点突出“社会价值（S）”——人员管理、职业健康安全、服务质量、风险管理、社区贡献\n` +
    `- 采用“披露现状 + 改进建议 + 下一步数据收集清单”的写法，避免编造数据\n` +
    `- 需要目录（TOC），并保持标题层级清晰\n` +
    `- 必须包含：公司概况、核心服务价值展示（含至少3个典型项目案例）、重要性议题（简版）、环境（E）、社会（S，重点：人员与职业健康安全）、治理（G）、数据口径与边界说明、未来行动计划\n` +
    (hasAttachments ? `- 必须包含一节“资质与知识产权/证明材料（来自客户上传）”，只引用上传材料中明确出现的名称/编号/事实，并注明来源文件名\n` : ``) +
    `- 如果关键数据缺失，请用“未披露/待补充”并给出具体可执行的补充建议\n` +
    `- 在报告开头给出：\n` +
    `  1) 客户公司类型判断（例如：保安服务企业/物业安保/安防运营/综合安全服务等）\n` +
    `  2) 数据质量评级（高/中/低）及原因\n\n` +
    `客户公司信息：${JSON.stringify(company, null, 2)}\n\n` +
    `客户服务运营数据：${JSON.stringify(serviceData, null, 2)}\n\n` +
    `客户典型项目数据（p1/p2/p3）：${JSON.stringify(projectsData, null, 2)}\n\n` +
    `客户社会（S）数据（人员与职业健康安全）：${JSON.stringify(socialData, null, 2)}\n\n` +
    `客户环境（E）数据：${JSON.stringify(environmentData, null, 2)}\n\n` +
    `客户治理（G）数据：${JSON.stringify(governanceData, null, 2)}\n\n` +
    (hasAttachments ? `客户上传材料抽取文本（可能有截断/噪声，仅供引用明确事实）：\n${attachmentsText}\n\n` : ``) +
    `注意：不得虚构客户未提供的事实或数字。对于需要引用标准条款的部分，用“建议对齐：交易所/监管/行业指引（可选）”的方式表达，不要编造具体条款编号。\n` +
    `特别注意：对于保安服务企业，请在“社会（S）”章节重点体现：一线安保人员培训、持证上岗覆盖率、职业健康安全管理、员工关怀举措、事故率与缺勤天数等；在“服务价值”章节体现响应时效、事件处置、客户满意度等可量化指标。`
  );
}
