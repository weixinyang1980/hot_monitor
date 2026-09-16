# Hot Monitor

Hot Monitor 是一个面向中国电信研发团队的 AI 热点监控工具。它可按关键词采集、筛选和展示 AI 技术动态，帮助研发人员更快跟踪值得关注的信息。

## 你将运行什么

- 后端 API：默认运行在 `http://localhost:8787`
- Web 控制台：默认运行在 `http://localhost:5173`
- 本地数据库：首次启动时自动创建在 `data/hot-monitor.db`

不配置任何 API Key 也可以启动项目，并使用 RSS 来源和本地规则完成基础体验。

## 开始前准备

1. 安装 [Node.js LTS](https://nodejs.org/)，建议使用 20 或更高版本。
2. 安装 [Visual Studio Code](https://code.visualstudio.com/)。
3. 将项目文件夹下载或克隆到本机。

在 VS Code 中点击“文件” -> “打开文件夹”，选择本项目的 `hot_monitor` 文件夹。

然后点击“终端” -> “新建终端”，输入下面的命令检查 Node.js 是否可用：

```powershell
node -v
npm -v
```

两个命令都能显示版本号即可继续。

## 第一次启动

在 VS Code 底部终端中，确认当前目录是项目根目录（能看到 `package.json`），依次执行：

```powershell
npm install
npm --prefix client install
npm run dev
```

说明：前两条命令会分别安装后端和前端依赖，首次执行需要等待一会儿；最后一条命令会同时启动前后端。看到类似以下内容说明启动成功：

```text
Hot Monitor API listening on http://localhost:8787
Local: http://localhost:5173/
```

在浏览器打开 [http://localhost:5173](http://localhost:5173)，即可进入 Hot Monitor 控制台。

## 第一次使用

1. 在页面中添加一个监控关键词，例如 `AI 编程`、`大模型` 或 `智能体`。
2. 点击手动扫描，等待扫描完成。
3. 在热点列表中查看标题、摘要、来源和相关性信息；点击来源可打开原始页面。

首次扫描没有结果并不代表启动失败：可先确认关键词已启用，并检查页面中的来源状态。RSS 来源需要能够访问互联网，网页、X/Twitter 来源还需要配置相应密钥。

## 可选：启用更多能力

基础启动不需要配置文件。需要启用 AI 研判、网页搜索或 X/Twitter 来源时，在项目根目录复制示例配置：

```powershell
Copy-Item .env.example .env
Copy-Item client\.env.example client\.env
```

如果目标文件已经存在，请直接在 VS Code 中打开并修改它，不要重复复制。常用配置如下：

| 配置项 | 用途 | 是否必需 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 使用 DeepSeek 进行内容相关性和技术性判断 | 否 |
| `FIRECRAWL_API_KEY` | 搜索可信网页与新闻来源 | 否 |
| `TWITTERAPI_API_KEY` | 获取 X/Twitter 热门信息 | 否 |
| `SMTP_*`、`MAIL_*` | 发送邮件通知 | 否 |
| `PORT` | 修改后端端口，默认 `8787` | 否 |
| `VITE_API_URL` | 前端访问的后端地址，默认 `http://localhost:8787` | 否 |

密钥只填写在根目录 `.env` 中，不要提交、截图或发送给他人。修改 `.env` 或 `client/.env` 后，先在终端按 `Ctrl + C` 停止服务，再重新执行 `npm run dev`。

## 检查是否正常

启动后，可直接在浏览器打开 [http://localhost:8787/api/health](http://localhost:8787/api/health)。看到包含 `"ok":true` 的内容，说明后端正常运行。

也可以在新的 VS Code 终端中执行：

```powershell
npm test
npm run build
```

两条命令均执行成功，表示自动化测试和前后端构建通过。

## 常见问题

### 终端提示 `node` 或 `npm` 不是内部或外部命令

Node.js 尚未安装完成，或安装后 VS Code 没有重新打开。安装 Node.js LTS 后关闭并重新打开 VS Code，再执行 `node -v` 检查。

### `npm run dev` 提示端口已被占用

通常是之前启动的项目还在运行。回到原来的终端按 `Ctrl + C` 停止它，再重新执行 `npm run dev`。默认需要使用 `5173` 和 `8787` 两个端口。

### 页面打开了，但显示无法连接服务

确认运行 `npm run dev` 的终端没有报错，并检查浏览器地址是 `http://localhost:5173`。若你修改了后端 `PORT`，还要同步将 `client/.env` 中的 `VITE_API_URL` 改为对应地址。

### 安装依赖时报错

先确认 `node -v` 显示的是 Node.js 20 或更高版本，然后分别重新执行：

```powershell
npm install
npm --prefix client install
```

## 停止项目

在正在运行 `npm run dev` 的 VS Code 终端中按 `Ctrl + C` 即可同时停止前端和后端服务。数据会保留在本机 `data` 文件夹，下次启动后仍可继续使用。