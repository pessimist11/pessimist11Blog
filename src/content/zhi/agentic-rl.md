---
title: 'Agentic RL 入门与论文精读路线'
pubDate: 2026-09-06
description: '面向真正入门的 Agentic RL 学习路线：先学什么、参考哪些论文、用哪些开源项目、怎么安排。'
tags: ['LLM', '强化学习', 'Agentic-RL', '学习路线']
---

> 目标：真正入门并最终能读懂、复现 Agentic RL 论文。
> 前提：已掌握 CoT → ReAct → Plan-and-Execute → Reflection → ToT → PPO → GRPO。
> 总体顺序：**Agent → RL 基础 → LLM RL → Reasoning RL → Agentic RL**

## 一、先学什么（按顺序）

1. **理解 Agent**：搞清楚 trajectory / action / observation / environment / reward 这几个概念，以及为什么 Agent 需要和环境交互。
2. **补 PPO**：如果 PPO 数学不熟，先补。重点掌握 policy、value function、reward、advantage、policy ratio 这 5 个概念，尤其是优势函数和比值公式（不然后面 GRPO 会痛苦）。
3. **LLM + RL**：理解「可验证环境 + 采样 + 奖励 + RL」为什么能让 LLM 学会推理，重点是 **Verifiable Reward**。
4. **GRPO / Reasoning RL**：串起 CoT、Self-Consistency、RL、GRPO、Reward、Verifier 这一条线。
5. **Agentic RL**：理解它和普通 LLM RL 的区别——面向有时间延展性的 POMDP，关注 planning / tool use / memory / reasoning / self-improvement，以及长轨迹带来的 Credit Assignment / Sparse Reward / Long-Horizon 三大问题。

## 二、参考哪些论文（分阶段，附链接）

### 阶段 1 · 理解 Agent
- **ReAct: Synergizing Reasoning and Acting in Language Models**（ICLR 2023）
  [arXiv:2210.03629](https://arxiv.org/abs/2210.03629) — 不要纠结实验数字，搞懂概念即可。

### 阶段 2 · RL 基础
- **Proximal Policy Optimization Algorithms**（2017）
  [arXiv:1707.06347](https://arxiv.org/abs/1707.06347) — 不用逐字精读，重点搞懂 clipping / ratio / advantage。

### 阶段 3 · LLM Reasoning RL（当前重点）
- **DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models**
  [arXiv:2402.03300](https://arxiv.org/abs/2402.03300) — GRPO 前身，理解「数学题 = 可自动验证的环境」。
- **DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning**（必读）
  [arXiv:2501.12948](https://arxiv.org/abs/2501.12948) — 串起 CoT / Self-Consistency / RL / GRPO / Reward / Verifier。重点看 R1-Zero 的推理涌现，以及 R1 的 cold-start 与多阶段训练。

### 阶段 4 · 正式进入 Agentic RL
- **The Landscape of Agentic Reinforcement Learning for LLMs: A Survey**（TMLR 2026，**地图级**）
  [arXiv:2509.02547](https://arxiv.org/abs/2509.02547) — 不用一次读完。先看 Introduction → Definition → Taxonomy → Environment → Reward → Training → Challenges，据此建立领域地图，再按兴趣往下钻。

### 之后按方向读（别随机挑）
- **Toolformer** [arXiv:2302.04761](https://arxiv.org/abs/2302.04761) — 学会「什么时候调用工具」。
- **WebGPT** [arXiv:2112.09332](https://arxiv.org/abs/2112.09332) — LLM + Browser + Environment + 人类反馈，早期雏形。
- **Reflexion** [arXiv:2303.11366](https://arxiv.org/abs/2303.11366) — 与 Reflection 相关，注意它用语言反馈而非梯度更新参数。

## 三、参考哪些开源项目

**训练框架（真正跑 GRPO/PPO）**
- [**TRL**](https://github.com/huggingface/trl)（HuggingFace）：面向 LLM 的 RL，内置 GRPO / PPO，最适合入门跑通。
- [**verl**](https://github.com/volcengine/verl)（Volcengine）：DeepSeek / Qwen 等用的 RL 训练框架，支持 PPO / GRPO，工业级。
- [**OpenRLHF**](https://github.com/OpenRLHF/OpenRLHF)：RLHF 全家桶，PPO / GRPO 等。
- [**SkyRL**](https://github.com/SkyworkAI/SkyRL)：较新的 LLM RL 框架。

**参考实现 / 模型**
- [**DeepSeek-R1**](https://github.com/deepseek-ai/DeepSeek-R1) 与 [**DeepSeek-Math**](https://github.com/deepseek-ai/DeepSeek-Math) — 官方仓库，看它们怎么用 RL 训练。

**Agent 与工具环境（用来「做环境」）**
- [**SWE-bench**](https://github.com/SWE-bench/SWE-bench)（软件工程）— Coding Agent RL 的标准评测环境。
- [**WebArena**](https://github.com/web-arena-x/webarena) — 网页交互环境。
- [**AgentBench**](https://github.com/THUDM/AgentBench) — 多环境评测基准。
- [**Gymnasium**](https://github.com/Farama-Foundation/Gymnasium) — 通用 RL 环境库。

**Agent 框架（可参考封装思路）**
- [**OpenHands**（原 OpenDevin）](https://github.com/OpenHands/OpenHands) 与 [**SWE-agent**](https://github.com/SWE-agent/SWE-agent) — 代码 Agent。
- [**Aider**](https://github.com/Aider-AI/aider) — 轻量编码 Agent，便于理解工具调用闭环。

## 四、学习方法

- 别从 RL 教科书重头学，你已经不是零基础。
- 读论文不要盯 benchmark 数字，重点搞懂环境、reward、训练流程这些「机制」。
- 每读完一篇，用自己的话复述它是怎么定义 environment / trajectory / reward 的。

**两周安排**
- 第 1 周（基础补齐）：ReAct → PPO → Toolformer → Reflexion。
- 第 2 周（Reasoning RL）：DeepSeekMath → DeepSeek-R1。
- 第 3 周起（总览）：Agentic RL Survey，先看框架再看细节。

## 五、时间有限：只读 5 篇

| 顺序 | 论文 | 目的 | 精读？ |
|---|---|---|---|
| ① | [ReAct](https://arxiv.org/abs/2210.03629) | 理解 Agent | 否 |
| ② | [PPO](https://arxiv.org/abs/1707.06347) | RL Policy Optimization | 否（懂 ratio / advantage） |
| ③ | [DeepSeekMath](https://arxiv.org/abs/2402.03300) | LLM + RL | 否 |
| ④ | [DeepSeek-R1](https://arxiv.org/abs/2501.12948) | GRPO + Reasoning RL | **是** |
| ⑤ | [Agentic RL Survey](https://arxiv.org/abs/2509.02547) | 建立领域地图 | **是** |

## 六、最后：动手实践

读懂后不要继续无脑加论文，**自己跑通一个极简闭环**：`LLM Agent → 调用工具 → 环境反馈 → 得到 Reward → GRPO → 更新 Policy`。

推荐用 **TRL 的 GRPO 示例 + Gymnasium/自定义环境**，先在「数学题」或「简单 Python 编码」上跑一次，理解会直接上一个台阶。
