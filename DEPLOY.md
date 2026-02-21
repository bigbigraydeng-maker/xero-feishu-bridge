# Xero-Feishu Bridge 部署指南

## ✅ 当前状态

### 已完成
- ✅ Node.js 服务已创建 ([server.js](file:///c:/Users/Zhong/.openclaw/xero-feishu-bridge/server.js))
- ✅ 服务已在 http://127.0.0.1:5001 运行
- ✅ ngrok 已下载到 c:\Users\Zhong\.openclaw\ngrok\

### 待完成
- ⏳ 配置 ngrok authtoken
- ⏳ 启动 ngrok 获取公网地址
- ⏳ 配置飞书事件订阅

---

## 🚀 部署步骤

### 第一步：配置 ngrok（仅需一次）

1. 访问 https://dashboard.ngrok.com/get-started/your-authtoken
2. 用 GitHub/Google 账号注册/登录
3. 复制你的 authtoken（格式：ngrok_xxxxxxxx...）
4. 运行配置脚本：
   ```bash
   c:\Users\Zhong\.openclaw\xero-feishu-bridge\setup-ngrok.bat
   ```
5. 按提示输入 authtoken

### 第二步：启动 ngrok

在**新终端窗口**中运行：
```bash
c:\Users\Zhong\.openclaw\ngrok\ngrok.exe http 5001
```

你会看到类似输出：
```
Forwarding  https://abc123-def.ngrok-free.app -> http://localhost:5001
```

**复制这个 https 地址**（例如：`https://abc123-def.ngrok-free.app`）

### 第三步：配置飞书事件订阅

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 找到应用：**cli_a9139fddafb89bb5**
3. 点击 **事件订阅**
4. 开启 **`im.message.receive_v1`** 事件
5. 设置 **请求地址**：
   ```
   https://abc123-def.ngrok-free.app/feishu
   ```
   （将 abc123-def 替换为你的 ngrok 地址）
6. 点击 **保存**

### 第四步：将机器人加入群聊

1. 打开飞书群
2. 点击群设置 → 群机器人
3. 添加机器人 → 选择 **cli_a9139fddafb89bb5**

### 第五步：测试

在飞书群发送：
```
开票 ABC abc@email.com 2
```

**预期返回**：
```
开票完成：INV-000X 邮件状态:204
```

---

## 📁 文件说明

| 文件 | 用途 |
|------|------|
| `server.js` | Node.js 主服务（已运行） |
| `start.bat` | 启动服务脚本 |
| `setup-ngrok.bat` | ngrok 配置脚本 |
| `start-ngrok.bat` | ngrok 启动脚本 |
| `app.py` | Python 版本（备用） |

---

## 🔧 故障排查

### 服务无法启动
- 检查端口 5001 是否被占用
- 检查 Node.js 是否安装：`node --version`

### ngrok 启动失败
- 确认已配置 authtoken
- 检查网络连接

### 飞书没有反应
1. 检查服务是否运行：访问 http://127.0.0.1:5001/
2. 检查 ngrok 是否运行：访问 https://你的地址.ngrok-free.app/
3. 检查飞书事件订阅地址是否正确
4. 检查机器人是否已添加到群聊

### 开票失败
- 检查 Xero API 是否可访问
- 检查客户邮箱格式
- 检查数量是否为数字

---

## 📝 重要提示

1. **ngrok 免费版** 每次重启会更换 URL，需要更新飞书配置
2. **两个窗口必须同时运行**：Node.js 服务 + ngrok
3. **生产环境** 建议部署到云服务器，避免使用 ngrok

---

## 🎯 系统架构

```
用户飞书消息
    ↓
飞书服务器
    ↓
ngrok 公网地址 (https://xxx.ngrok-free.app)
    ↓
本地 Node.js 服务 (http://127.0.0.1:5001)
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

## 📞 支持

如有问题，请检查：
1. 服务日志输出
2. ngrok 状态
3. 飞书事件订阅配置
