# Agent Guidelines & Project Memory

## Dev Server & Test Execution Policy (核心开发与测试原则)
- **测试/启动本地dev服务卡住时，直接跳过该步骤继续开发**：
  在运行本地开发服务（如 `npm run dev` / `start dev server`）或运行测试时，如果遇到进程挂起、卡住不动或耗时超过预期，**一律直接跳过该步骤，继续进行代码开发与功能实现**，严禁死等阻塞流程。
- **验证手段优先级**：
  1. 优先使用快速离线单元测试：`npm test`（`vitest run`）。
  2. 优先使用严格类型检查与生产打包：`npm run build`（`tsc --noEmit && vite build`）。
  3. 优先使用线上生产环境或已部署预览地址进行端到端视觉与游戏体验验证。
  4. 本地 dev server 仅作为辅助，启动失败或卡住时立即跳过，绝不阻塞主任务。
- **本地 dev 服务管理要求**：
  - `npm run dev` 是长期运行的后台守护进程，严禁以前台同步命令等待其退出。
  - 若端口（5180）被旧进程占用或无法绑定，直接清理孤儿进程；如果仍然异常，直接跳过启动步骤。

## Codebase Constraints
- 仓库限定：`holynova/mafa-survivor-game`
- 全局禁令：代码、注释、提交信息（Commit Message）及 UI 文本中严禁使用任何 Emoji 表情。
