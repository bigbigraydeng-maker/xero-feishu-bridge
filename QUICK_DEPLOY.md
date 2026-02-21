# Xero-Feishu Bridge - 快速部署指南

## 方案：直接上传到 Render（无需 GitHub）

由于命令行环境限制，推荐使用 Render 的 **Blueprint** 功能直接部署。

---

## 部署文件清单

项目目录：`c:\Users\Zhong\.openclaw\xero-feishu-bridge`

需要上传的文件：
1. **server.js** - 主服务程序
2. **package.json** - 依赖配置
3. **README.md** - 项目说明（可选）

---

## 部署步骤

### 第一步：准备代码文件

确认以下文件已准备好：
- ✅ server.js
- ✅ package.json

### 第二步：在 Render 创建服务

1. 访问 https://dashboard.render.com/
2. 点击 **New +** → **Web Service**
3. 选择 **Deploy from a Git repository** 或 **Deploy from a public Git repository**

### 第三步：配置服务

由于无法直接创建 GitHub 仓库，您有以下选择：

#### 选项 A：使用 Render Blueprint（推荐）

创建 `render.yaml` 文件：

```yaml
services:
  - type: web
    name: xero-feishu-bridge
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

#### 选项 B：手动创建 GitHub 仓库

1. 访问 https://github.com/new
2. 创建仓库：`xero-feishu-bridge`
3. 上传文件：
   - 点击 "uploading an existing file"
   - 上传 server.js 和 package.json
   - 提交更改
4. 在 Render 连接此仓库

### 第四步：Render 配置

| 配置项 | 值 |
|--------|-----|
| **Name** | xero-feishu-bridge |
| **Region** | Singapore |
| **Branch** | main |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

点击 **Create Web Service**

### 第五步：获取公网地址

部署完成后，您会得到类似地址：
```
https://xero-feishu-bridge.onrender.com
```

---

## 配置飞书

1. 登录 https://open.feishu.cn/
2. 找到应用：**cli_a9139fddafb89bb5**
3. 进入 **事件订阅**
4. 开启 **im.message.receive_v1**
5. 设置请求地址：
   ```
   https://xero-feishu-bridge.onrender.com/feishu
   ```
6. 保存

---

## 测试

在飞书群发送：
```
开票 ABC abc@email.com 2
```

---

## 备选方案：本地打包上传

如果上述方案复杂，可以：

1. 将整个 `xero-feishu-bridge` 文件夹压缩为 zip
2. 使用 Render 的 "Upload your code" 功能（如果有）
3. 或者使用其他平台如 Vercel、Railway

---

## 需要帮助？

由于环境限制，我无法直接操作 GitHub。但代码已准备就绪，您只需要：

1. 创建 GitHub 仓库
2. 上传 server.js 和 package.json
3. 在 Render 连接仓库

整个过程约 5 分钟完成。
