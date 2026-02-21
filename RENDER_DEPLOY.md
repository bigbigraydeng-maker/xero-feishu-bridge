# Xero-Feishu Bridge - Render 部署指南

## 项目说明

将 Xero 自动开票系统部署到 Render，实现稳定的云端服务，无需本地 ngrok 穿透。

---

## 📁 部署文件

项目包含以下文件：
- `server.js` - 主服务程序
- `package.json` - Node.js 依赖配置

---

## 🚀 Render 部署步骤

### 第一步：创建 GitHub 仓库

1. 访问 https://github.com/new
2. 创建新仓库，例如：`xero-feishu-bridge`
3. 将以下文件上传到仓库：
   - `server.js`
   - `package.json`

### 第二步：在 Render 创建 Web Service

1. 登录 https://dashboard.render.com/
2. 点击 **New +** → **Web Service**
3. 选择 **Build and deploy from a Git repository**
4. 连接你的 GitHub 账号，选择 `xero-feishu-bridge` 仓库
5. 配置如下：

| 配置项 | 值 |
|--------|-----|
| **Name** | xero-feishu-bridge |
| **Region** | Singapore (靠近中国) |
| **Branch** | main |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

6. 点击 **Create Web Service**

### 第三步：获取 Render 公网地址

部署完成后，Render 会提供一个公网地址，例如：
```
https://xero-feishu-bridge.onrender.com
```

**复制这个地址**，用于配置飞书事件订阅。

---

## 🔧 配置飞书事件订阅

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 找到应用：**cli_a9139fddafb89bb5**
3. 进入 **事件订阅** 设置
4. 开启 **`im.message.receive_v1`** 事件
5. 设置 **请求地址**：
   ```
   https://xero-feishu-bridge.onrender.com/feishu
   ```
   （替换为你的 Render 地址）
6. 点击 **保存**

---

## 🤖 将机器人加入群聊

1. 打开飞书群
2. 点击群设置 → 群机器人
3. 添加机器人 → 选择 **cli_a9139fddafb89bb5**

---

## 🧪 测试

在飞书群发送：
```
开票 ABC abc@email.com 2
```

**预期返回**：
```
开票完成：INV-000X 邮件状态:204
```

---

## 📊 系统架构

```
用户飞书消息
    ↓
飞书服务器
    ↓
Render Web Service (https://xxx.onrender.com)
    ↓
Xero API (https://xero-invoice-bot.onrender.com)
    ↓
创建发票 + 发送邮件
    ↓
飞书 API 回复消息
    ↓
用户看到结果
```

---

## ✅ 优势对比

| 特性 | 本地 ngrok 方案 | Render 云端方案 |
|------|-----------------|-----------------|
| 稳定性 | ❌ 不稳定，会断线 | ✅ 24/7 稳定运行 |
| 公网地址 | ❌ 每次重启变化 | ✅ 固定地址 |
| 需要本地电脑 | ✅ 必须开机 | ❌ 不需要 |
| 配置复杂度 | ⚠️ 中等 | ✅ 简单 |
| 成本 | 免费 | 免费 (Free Plan) |

---

## 🔍 故障排查

### 飞书没有反应
1. 检查 Render 服务是否运行：访问 `https://你的地址.onrender.com/`
2. 检查飞书事件订阅地址是否正确
3. 检查机器人是否已添加到群聊
4. 查看 Render 日志（Dashboard → Logs）

### 开票失败
1. 检查 Xero API 是否可访问
2. 检查客户邮箱格式
3. 检查数量是否为数字
4. 查看 Render 日志中的错误信息

### Render 服务休眠（Free Plan）
- Free Plan 15分钟无访问会休眠
- 首次访问可能需要等待 30 秒唤醒
- 可以配置 UptimeRobot 定期 ping 保持活跃

---

## 📝 重要提示

1. **Free Plan 限制**：
   - 服务 15 分钟无访问会休眠
   - 每月 750 小时运行时间
   - 足够个人/小团队使用

2. **升级方案**：
   - 如果需要 24/7 无休眠，可升级到 Starter Plan ($7/月)

3. **日志查看**：
   - Render Dashboard → 你的服务 → Logs
   - 可以实时查看服务日志

---

## 📞 支持

如有问题，请检查：
1. Render 服务日志
2. 飞书事件订阅配置
3. 机器人权限设置
