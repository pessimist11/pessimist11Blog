---
title: '研0暑假·LLM 应用开发突围路线'
pubDate: 2026-07-15
description: '7周走通 LLM 应用开发完整链路，从 Python 工程到 Agent/MCP 部署上线。'
tags: ['LLM', 'RAG', 'Agent', 'MCP', '学习计划']
---

时间窗口：从暑假7月开始到9月开学。

总目标：走通一条完整的 LLM 应用链路，到研一开学时已经能拿出可演示的个人项目，简历上可以直接写上去面试。

---

## 整体节奏

`基础搭建` → `LLM 基础` → `RAG 实战` → `Agent/MCP` → `部署上线` → `复盘`
　W1　　　　W2　　　　W3-4　　　　W5　　　　　W6　　　　　W7

---

## 第一阶段：基础搭建（W1）

**目标**：环境跑通，能顺利调用模型。

| 任务 | 具体内容 | 产出物 |
|------|---------|--------|
| Python 工程环境 | 配好 `pyenv` / `conda`，搞清 `venv`、`pip`、`poetry` 区别 | 能随手新建项目 |
| LLM API 实战 | 注册 DeepSeek / 通义千问 / GLM 至少两个平台的 API，调通流式聊天、非流式 | 一个 API wrapper 脚本 |
| Function Calling | 写一个 function calling 示例：让 LLM 调用天气查询 / 计算器 / 搜索函数 | 理解 tool call 全流程 |
| 阅读 | OpenAI Function Calling 文档 + 国内大模型的 tool use 文档 | 笔记 |

**W1 结束能回答：**

- 怎么让 LLM 返回结构化 JSON？
- 假设我写了一个 `get_weather(city)` 函数，LLM 怎么决定调用它？

---

## 第二阶段：RAG 完全掌握（W2-3）

**目标**：从零搭一个能用的 RAG 系统。

### W2 — 基础 RAG 链路

| 任务 | 具体内容 | 产出物 |
|------|---------|--------|
| 向量数据库 | 装 ChromaDB（本地轻量），学会 `add` / `query` / `delete` | 一个能存能查的脚本 |
| Embedding | 用 `text2vec` / `BGE` / `moka-ai` 等中文 embedding 模型，对比效果 | 对比笔记 |
| 文档切分 | 试 LangChain 的 `RecursiveCharacterTextSplitter`，再自己手写一个 | 理解 chunk size 影响 |
| 完整链路 | 读取 PDF → 切分 → embedding → 存库 → 检索 → 拼接 prompt → LLM 回答 | 一个命令行 RAG 问答工具 |
| 阅读 | LangChain RAG 教程 + 自己复现 | 笔记 |

### W3 — RAG 优化（拉开差距的关键）

| 任务 | 具体内容 | 产出物 |
|------|---------|--------|
| Hybrid Search | 集成 BM25（关键词检索）+ 向量检索，对比单独使用 | 理解检索策略 |
| Reranker | 接入 BGE-reranker，理解为什么 rerank 能提升质量 | 一个带 rerank 的 pipeline |
| Query 改写 | 实现简单 query rewriting（LLM 改写用户问题再检索） | query rewrite 模块 |
| Multi-turn RAG | 带历史对话的 RAG 场景 | 多轮对话 demo |
| 项目落地 | 选一个自己感兴趣的领域（课程资料 / 技术博客 / 论文库）做知识问答 Bot | 个人项目雏形 |

**W3 结束能回答：**

- 检索质量不好怎么办？（chunk 策略 / hybrid / rerank / query rewrite 讲清楚）
- 聊 RAG 能从 naive RAG 讲到 advanced RAG 的演进过程

---

## 第三阶段：Agent & MCP（W4-5）

**目标**：理解 Agent 范式，跟上前沿 MCP。

### W4 — Agent 核心

| 任务 | 具体内容 | 产出物 |
|------|---------|--------|
| ReAct 范式 | 读 ReAct 论文（理解思路即可），手写一个 ReAct Loop（不依赖框架） | 手写 ReAct 代码 |
| Tool Use 深入 | 实现多 tool 路由、tool 调用结果回传、错误重试 | 加深对 function calling 的理解 |
| LangChain Agent | 用 LangChain 搭一个简单 Agent（搜索 + 计算 + 查询） | 理解框架帮我们做了什么 |
| 对比分析 | 手写 vs LangChain Agent — 哪个灵活？哪个好调试？ | 对比笔记 |

### W5 — MCP 协议（差异化优势）

| 任务 | 具体内容 | 产出物 |
|------|---------|--------|
| 理解 MCP | 读 MCP 官方 spec，理解核心概念：Server / Client / Tool / Resource / Prompt | 笔记 |
| 跑通 MCP | 装 MCP SDK，跑通 demo：Local MCP Server + Client | MCP demo |
| 自定义 MCP 工具 | 写自己的 MCP Server，如：文件系统工具 / 代码执行器 / 数据库查询 | 可复用的 MCP Server |
| 整合 RAG + Agent | 把前两周的 RAG 系统包装成 Agent 的 tool，让 Agent 自主决定何时查知识库 | **核心项目** |

**W5 结束能回答：**

- Agent 和普通 API 调用的本质区别是什么？
- MCP 解决了什么问题？（跟直接调 API 比优势在哪）
- Agent + RAG 怎么结合？各自的边界在哪？

---

## 第四阶段：部署上线（W6）

**目标**：让项目能从浏览器 / 手机访问，简历上写「已部署」。

| 任务 | 具体内容 | 产出物 |
|------|---------|--------|
| FastAPI | 把 RAG/Agent 包装成 RESTful API 服务 | 可调用的 API |
| Gradio / Streamlit | 搭一个简单的 Web 界面（聊天框即可） | Web Demo |
| Docker | 写 Dockerfile + docker-compose，容器化服务 | `docker-compose.yml` |
| 部署 | 部署到云（阿里云/腾讯云免费额度 / Railway / HuggingFace Spaces） | 线上可访问的链接 |
| 加域名（可选） | 有域名的话绑一下，加分 | — |

**W6 结束能回答：**

- 你做的这个东西 demo 呢？—— 直接甩链接
- 线上部署的延时、并发、成本情况 —— 心里有数

---

## 第五阶段：复盘 & 简历化（W7）

**目标**：把做过的东西变成简历上的项目描述。

| 任务 | 具体内容 |
|------|---------|
| 写 README | 每个项目写清楚背景、技术栈、难点、效果 |
| 整理简历条目 | 把 RAG 项目、Agent 项目写成 STARR 结构 |
| 刷题捡起来 | LeetCode 重回节奏，重点：数组、字符串、哈希表、树、DP（Medium 为主） |
| 八股预扫 | HTTP / TCP / OS 基础 — 不用全部背，但面试常见题过一遍 |
| 整理项目亮点 | 想清楚：你遇到了什么问题？怎么解决的？收获是什么？ |

---

## 每周精力分配建议

| 方向 | 占比 |
|------|------|
| Python 工程 | 15% |
| LLM 概念 / 论文 | 20% |
| 手写代码 | 35% |
| 框架使用 | 20% |
| 文档 / 笔记 | 10% |

---

## 算法刷题伴随计划

| 优先级 | 类型 | 重点 | 题量 |
|--------|------|------|------|
| 🔴 必须 | 数组 / 字符串 | 双指针、滑动窗口、前缀和 | 20 |
| 🔴 必须 | 哈希表 | 两数之和、变种 | 10 |
| 🔴 必须 | 二叉树 | 遍历、最近公共祖先、层序 | 15 |
| 🟡 重点 | 动态规划 | 背包、子序列、区间 DP（Easy-Medium） | 15 |
| 🟡 重点 | 栈 / 队列 | 单调栈、优先队列 | 10 |
| 🟢 有余力 | 图 / DFS / BFS | 岛屿问题、拓扑排序 | 10 |
| 🟢 有余力 | 排序 / 二分 | 二分变种、快排 / 归并手写 | 10 |

**刷题策略：**

- 先刷 Hot 100 的数组 / 字符串 / 树部分（或 Top Interview 150）
- 按类型刷，不按随机顺序
- 每道题看题 15 分钟没思路 → 看题解 → 理解后自己手敲一遍
- 做好标记：❌ 完全不会 / ⚠️ 看了思路写出来 / ✅ 独立 AC
- 二刷只刷标记 ❌ 和 ⚠️ 的

---

## 每周算法伴随节奏

| 周次 | 主线任务 | 算法重点 |
|------|---------|---------|
| W1 | 基础搭建 | 数组 / 哈希表 |
| W2 | RAG 基础 | 双指针 / 滑动窗口 |
| W3 | RAG 优化 | 二叉树 |
| W4 | Agent 核心 | DP 入门 |
| W5 | MCP | 栈 / 队列 |
| W6 | 部署上线 | 二刷错题 |
| W7 | 复盘总结 | 面试高频模拟 |
