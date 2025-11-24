# COMP3810SEF Group 1 · 校园二手物品交易平台

基于 Node.js + Express + MongoDB 构建的全功能校园二手物品交易平台，满足 “发布 — 查询 — 编辑 — 删除” 完整闭环，支持多条件筛选、RESTful API、图片上传以及 cookie-session 登录认证。前端使用 EJS + Bootstrap 5，整体 UI 黑白 + 渐变主题，适配桌面与移动端。项目已准备好部署到 Render，配套 README、API 测试指令与演示指南，助力课程拿满基础分并获取原创加分。

> 课程代码：COMP3810SEF (可按需替换)  
> 小组：Group 1（请替换为实际组号/成员信息）

---

## 目录

- [功能亮点](#功能亮点)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [本地开发流程](#本地开发流程)
- [RESTful API](#restful-api)
- [Render 云部署](#render-云部署)
- [测试账号示例](#测试账号示例)
- [项目结构](#项目结构)

---

## 功能亮点

- **安全认证**：注册校验用户名唯一，密码使用 `bcrypt` 加密；`cookie-session` 管理登录态，未登录用户无法访问物品管理页面。
- **CRUD 闭环**：支持创建/查询/编辑/删除，表单实时校验（价格不得为负、描述长度限制等），删除附带确认弹窗。
- **多条件筛选**：关键词、分类、价格区间组合搜索，同时提供自动触发筛选的交互脚本，满足原创加分。
- **图片上传**：`multer` 上传图片存放于 `public/uploads`，前端自动渲染。
- **RESTful API**：GET/POST/PUT/DELETE 基础接口 + “按分类查询 & 热门 TOP10” 原创 API，可直接用于移动端或第三方应用拓展。
- **美观响应式 UI**：EJS + Bootstrap 5 + 自定义 CSS，适配 PC 与手机端，交互清晰。
- **双语界面**：内置中/英语言切换，按钮和表单实时切换文案，同时保持数据字段一致，方便本地与交换生共同使用。
- **云端部署**：脚本兼容 Render，配置 `npm install` + `node server.js` 即可上线，README 提供 CURL 测试命令和 URL 占位。

---

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | EJS 模板、Bootstrap 5、自定义 CSS/JS |
| 后端 | Node.js、Express.js、cookie-session、multer、express-validator |
| 数据库 | MongoDB + Mongoose |
| 认证 | bcryptjs（密码加密）、cookie-session（会话） |
| 部署 | Render（可替换为 Railway/Heroku 等） |

---

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/comp3810sef-group1.git
cd comp3810sef-group1

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev            # 使用 nodemon
# 或
npm start              # node server.js
```

默认服务运行在 `http://localhost:3000`，如果未配置 `.env`，将使用内置的本地 MongoDB 连接字符串 `mongodb://127.0.0.1:27017/campus-market`。

---

## 本地开发流程

1. 启动 MongoDB（本地或使用 MongoDB Atlas 云实例）。
2. 运行 `npm run dev`，访问 `http://localhost:3000`。
3. 注册第一个用户后即可发布/管理物品。图片上传会写入 `public/uploads`。
4. 修改完代码后，可运行 `npm start` 验证生产模式行为。
5. 提交前删除 `node_modules`，再压缩为 `comp3810sef-project-groupX.zip`。

### 环境变量示例（在项目根目录新建 `.env`）

```
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/campus-market
SESSION_SECRET=replace-with-secure-random
```

---

## RESTful API

| 方法 | 路径 | 描述 |
| --- | --- | --- |
| GET | `/api/items/:id` | 查询单个物品详情 |
| POST | `/api/items` | 创建物品（需登录，会话复用） |
| PUT | `/api/items/:id` | 更新物品（仅发布者可操作） |
| DELETE | `/api/items/:id` | 删除物品（仅发布者） |
| GET | `/api/items/category/:category` | **原创**：按分类批量查询 |
| GET | `/api/items/hot/top10` | **原创**：按发布时间排序热门 TOP10 |

示例 CURL（部署后请替换域名和 Cookie）：

```bash
# 查询热门
curl https://comp3810sef-group1.onrender.com/api/items/hot/top10

# 按分类查询书籍
curl https://comp3810sef-group1.onrender.com/api/items/category/%E4%B9%A6%E7%B1%8D

# 创建物品（需携带登录后的 cookie）
curl -X POST https://comp3810sef-group1.onrender.com/api/items ^
  -H "Content-Type: application/json" ^
  -H "Cookie: session=xxx" ^
  -d "{\"title\":\"线性代数教材\",\"category\":\"书籍\",\"price\":35,\"description\":\"九成新\"}"
```

---

## Render 云部署

1. 新建 Render Web Service，连接 GitHub 仓库。
2. Build Command：`npm install`
3. Start Command：`node server.js`
4. 在 Render 的 Environment 里配置：
   - `MONGODB_URI`：MongoDB Atlas 连接串
   - `SESSION_SECRET`：自定义随机字符串
5. 部署成功后，将 Render URL （例如 `https://comp3810sef-group1.onrender.com`）填入 README 与课程要求的 Google 表格。

---

## 测试账号示例

| 用户名 | 密码 | 备注 |
| --- | --- | --- |
| `demo` | `Demo1234` | 部署后可提前创建，便于老师测试 |

> 注意：实际提交前请在 README 中写上所有成员姓名、SID、分工以及 Render 线上地址。

---

## 项目结构

```
comp3810sef-group1
├─ models/            # Mongoose 数据模型（User / Item）
├─ public/
│  ├─ css/            # 自定义样式
│  ├─ js/             # 前端交互脚本
│  └─ uploads/        # 物品图片（含 .gitkeep）
├─ views/             # EJS 模板（登录、注册、物品 CRUD、公共组件）
├─ server.js          # Express 入口：路由、会话、API、Multer
├─ package.json       # 依赖与脚本
└─ README.md          # 本文件：部署 & 测试指南
```

---

如需拓展功能（私信、收藏、评论等）可在现有结构基础上继续扩展。祝项目演示顺利，早日拿满分！💪

