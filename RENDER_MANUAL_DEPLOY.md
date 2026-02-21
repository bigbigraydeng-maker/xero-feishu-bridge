# Render 手动部署指南（付费版）

## 方案：直接在 Render Dashboard 创建服务

由于命令行限制，推荐直接在 Render 网页界面创建服务。

---

## 部署步骤

### 第一步：登录 Render

1. 访问 https://dashboard.render.com/
2. 使用您的付费账号登录

### 第二步：创建 Web Service

1. 点击 **New +** 按钮
2. 选择 **Web Service**
3. 选择 **Build and deploy from a Git repository**

### 第三步：连接代码

由于无法自动推送 GitHub，您有两个选择：

#### 选项 A：使用 Render 的 Git 仓库（最简单）

1. 在 Render 创建服务后，会获得一个 Git 仓库地址
2. 使用 Git 命令推送代码：

```bash
cd c:\Users\Zhong\.openclaw\xero-feishu-bridge
git remote add render https://github.com/YOUR_USERNAME/xero-feishu-bridge.git
git push -u render main
```

#### 选项 B：使用 Render 的 Web Shell

1. 创建服务后，进入 **Shell** 标签
2. 使用 Web Shell 直接编辑文件

### 第四步：配置服务

在 Render Dashboard 配置：

| 配置项 | 值 |
|--------|-----|
| **Name** | xero-feishu-bridge |
| **Region** | Singapore (或 Oregon) |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Standard (付费版，无休眠) |

### 第五步：添加环境变量（可选）

在 **Environment** 标签添加：
- `NODE_ENV` = `production`

### 第六步：部署

点击 **Create Web Service**

Render 会自动构建并部署。

---

## 获取公网地址

部署完成后，您会得到类似地址：
```
https://xero-feishu-bridge.onrender.com
```

**飞书回调地址**：
```
https://xero-feishu-bridge.onrender.com/feishu
```

---

## 配置飞书

1. 登录 https://open.feishu.cn/
2. 找到应用：**cli_a9139fddafb89bb5**
3. 进入 **事件订阅**
4. 请求地址填入：`https://xero-feishu-bridge.onrender.com/feishu`
5. 开启事件：`im.message.receive_v1`
6. 保存

---

## 代码文件清单

需要上传到 Render 的文件：

### 必需文件
1. **server.js** - 主服务程序
2. **package.json** - 依赖配置

### 可选文件
3. **README.md** - 项目说明
4. **render.yaml** - Render 配置（如果使用 Blueprint）

---

## 文件内容

### server.js
```javascript
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 5001;
const XERO_API = 'https://xero-invoice-bot.onrender.com/create-invoice';
const APP_ID = 'cli_a9139fddafb89bb5';
const APP_SECRET = 'BaChzUHA3iAPfddnIJ4T1eqvPqCMySPR';

async function getTenantToken() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            app_id: APP_ID,
            app_secret: APP_SECRET
        });

        const options = {
            hostname: 'open.feishu.cn',
            path: '/open-apis/auth/v3/tenant_access_token/internal/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.code === 0) {
                        resolve(result.tenant_access_token);
                    } else {
                        reject(new Error(result.msg));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function sendFeishuMessage(chatId, text, token) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: text })
        });

        const options = {
            hostname: 'open.feishu.cn',
            path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function createInvoice(customerName, customerEmail, qty) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            customer_name: customerName,
            customer_email: customerEmail,
            qty: parseInt(qty)
        });

        const options = {
            hostname: 'xero-invoice-bot.onrender.com',
            path: '/create-invoice',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: data });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000);
        req.write(postData);
        req.end();
    });
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'running', 
            service: 'xero-feishu-bridge',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    if (parsedUrl.pathname === '/feishu' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                console.log('收到飞书请求:', JSON.stringify(data, null, 2));

                if (data.challenge) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ challenge: data.challenge }));
                    return;
                }

                const event = data.event || {};
                const message = event.message || {};
                const contentStr = message.content || '';

                let text = '';
                if (contentStr) {
                    try {
                        const contentObj = JSON.parse(contentStr);
                        text = contentObj.text || '';
                    } catch (e) {
                        text = contentStr;
                    }
                }

                console.log('解析到的文本:', text);

                if (text.startsWith('开票')) {
                    const parts = text.split(' ');
                    
                    if (parts.length === 4) {
                        const [, name, email, qty] = parts;
                        
                        try {
                            console.log(`创建发票: ${name}, ${email}, ${qty}`);
                            const result = await createInvoice(name, email, qty);
                            console.log('Xero API 返回:', result);

                            const invoiceNumber = result.invoice_number || '失败';
                            const status = result.email_status || '未知';

                            const token = await getTenantToken();
                            const chatId = message.chat_id;
                            const replyText = `开票完成：${invoiceNumber} 邮件状态:${status}`;
                            
                            const sendResult = await sendFeishuMessage(chatId, replyText, token);
                            console.log('发送消息结果:', sendResult);

                        } catch (error) {
                            console.error('处理开票请求时出错:', error);
                            
                            try {
                                const token = await getTenantToken();
                                const chatId = message.chat_id;
                                await sendFeishuMessage(chatId, `开票处理失败: ${error.message}`, token);
                            } catch (e) {
                                console.error('发送错误消息失败:', e);
                            }
                        }
                    } else {
                        try {
                            const token = await getTenantToken();
                            const chatId = message.chat_id;
                            await sendFeishuMessage(
                                chatId,
                                '格式错误。使用方法：开票 客户名 邮箱 数量\n例如：开票 ABC abc@email.com 2',
                                token
                            );
                        } catch (e) {
                            console.error('发送帮助消息失败:', e);
                        }
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));

            } catch (error) {
                console.error('处理请求时出错:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: error.message }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'not found' }));
});

server.listen(PORT, () => {
    console.log('==========================================');
    console.log('Xero-Feishu Bridge 已启动');
    console.log('==========================================');
    console.log(`服务地址: http://127.0.0.1:${PORT}`);
    console.log('');
    console.log('可用端点:');
    console.log(`  健康检查: http://127.0.0.1:${PORT}/`);
    console.log(`  飞书回调: http://127.0.0.1:${PORT}/feishu`);
    console.log('');
    console.log('飞书 App ID:', APP_ID);
    console.log('Xero API:', XERO_API);
    console.log('==========================================');
});

process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    server.close(() => {
        console.log('服务已关闭');
        process.exit(0);
    });
});
```

### package.json
```json
{
  "name": "xero-feishu-bridge",
  "version": "1.0.0",
  "description": "Xero Invoice Bot - Feishu Enterprise App Bridge",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "xero",
    "feishu",
    "invoice",
    "bot"
  ],
  "author": "",
  "license": "MIT"
}
```

---

## 付费版优势

| 特性 | 免费版 | 付费版 (Standard) |
|------|--------|-------------------|
| 休眠 | 15分钟无访问休眠 | ✅ 永不休眠 |
| 响应时间 | 可能需要唤醒 | ✅ 即时响应 |
| 飞书超时 | 可能超时 | ✅ 不会超时 |
| 带宽 | 100GB/月 | 更高额度 |

---

## 部署后验证

1. 访问健康检查地址：
   ```
   https://xero-feishu-bridge.onrender.com/
   ```
   应该返回：`{"status":"running"...}`

2. 在飞书验证事件订阅

3. 测试开票功能

---

## 故障排查

如果部署失败，检查：
1. Build Command 是否正确：`npm install`
2. Start Command 是否正确：`npm start`
3. Node 版本是否 >= 18
4. 日志输出是否有错误
