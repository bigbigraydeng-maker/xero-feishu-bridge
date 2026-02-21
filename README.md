# Xero 自动开票系统 + 飞书企业应用对接

## 项目概述

实现飞书群输入开票指令，自动调用 Xero API 创建发票并发送邮件，最后返回发票号到飞书群。

**流程**：
```
飞书群消息 → 本地桥接服务 → Xero API → 创建发票 → 发送邮件 → 飞书群回复
```

---

## 项目结构

```
xero-feishu-bridge/
├── app.py              # 主程序 - Flask 服务
├── requirements.txt    # Python 依赖
├── run.bat            # 启动 Flask 服务脚本
├── start_ngrok.bat    # 启动 ngrok 穿透脚本
└── README.md          # 本说明文件
```

---

## 配置信息

### 云端 Xero API
- **地址**: `https://xero-invoice-bot.onrender.com`
- **接口**: `POST /create-invoice`
- **请求格式**:
  ```json
  {
    "customer_name": "ABC Pty Ltd",
    "customer_email": "abc@email.com",
    "qty": 2
  }
  ```
- **返回格式**:
  ```json
  {
    "invoice_number": "INV-0008",
    "email_status": 204
  }
  ```

### 飞书企业应用凭证（已配置）
- **App ID**: `cli_a9139fddafb89bb5`
- **App Secret**: `BaChzUHA3iAPfddnIJ4T1eqvPqCMySPR`

---

## 启动步骤

### 第一步：启动 Flask 服务

双击运行 `run.bat` 或在命令行执行：
```bash
python app.py
```

服务将在 http://127.0.0.1:5001 启动

**本地测试地址**：
- 健康检查: http://127.0.0.1:5001/
- 飞书回调: http://127.0.0.1:5001/feishu

### 第二步：启动 ngrok 穿透

双击运行 `start_ngrok.bat` 或在命令行执行：
```bash
c:\Users\Zhong\.openclaw\ngrok\ngrok.exe http 5001
```

复制显示的 **https** 地址，例如：
```
Forwarding https://abc123.ngrok-free.app -> http://localhost:5001
```

### 第三步：配置飞书事件订阅

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 找到应用：**cli_a9139fddafb89bb5**
3. 进入 **事件订阅** 设置
4. 开启 **`im.message.receive_v1`** 事件
5. 设置 **请求地址**：
   ```
   https://abc123.ngrok-free.app/feishu
   ```
   （将 abc123 替换为你的 ngrok 地址）
6. 保存配置

### 第四步：将机器人加入群聊

1. 在飞书群设置中
2. 添加机器人
3. 选择 **cli_a9139fddafb89bb5** 应用

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

## 功能说明

### 支持的指令格式
```
开票 客户名 邮箱 数量
```

**示例**：
- `开票 ABC abc@email.com 2`
- `开票 测试公司 test@example.com 5`

### 错误处理
- 格式错误时会提示正确用法
- Xero API 调用失败会返回错误信息
- 所有操作都有日志输出到控制台

---

## 故障排查

### 飞书没有反应
1. 检查 Flask 服务是否运行（看 run.bat 窗口）
2. 检查 ngrok 是否运行（看 start_ngrok.bat 窗口）
3. 确认飞书事件订阅地址是否正确
4. 检查飞书应用是否已添加到群聊
5. 查看控制台日志是否有请求到达

### 开票失败
1. 检查 Xero API 是否可访问
2. 检查客户邮箱格式是否正确
3. 检查数量是否为数字
4. 查看控制台错误日志

### ngrok 地址变更
- ngrok 免费版每次重启会更换 URL
- 需要同步更新飞书事件订阅中的请求地址

---

## 技术细节

### 飞书消息处理流程
1. 用户发送消息 → 飞书服务器
2. 飞书推送事件 → ngrok 地址
3. ngrok 转发 → 本地 Flask 服务
4. Flask 解析消息 → 调用 Xero API
5. Xero 创建发票 → 发送邮件
6. Flask 获取 token → 调用飞书 API 回复

### 关键 API
- **获取 tenant_token**: `POST /auth/v3/tenant_access_token/internal/`
- **发送消息**: `POST /im/v1/messages?receive_id_type=chat_id`

---

## 文件位置

项目目录：`c:\Users\Zhong\.openclaw\xero-feishu-bridge\`

---

## 注意事项

1. **ngrok 免费版** 有连接数限制，长时间运行可能需要重启
2. **Flask 服务** 和 **ngrok** 需要同时保持运行
3. 生产环境建议部署到云服务器，避免使用 ngrok
4. 确保 Xero OAuth 令牌有效，否则 API 会返回 401
