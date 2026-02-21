const http = require('http');
const https = require('https');
const url = require('url');

// Render 使用 PORT 环境变量，本地开发默认 5001
const PORT = process.env.PORT || 5001;
const XERO_API = 'https://xero-invoice-bot.onrender.com/create-invoice';
const APP_ID = 'cli_a9139fddafb89bb5';
const APP_SECRET = 'BaChzUHA3iAPfddnIJ4T1eqvPqCMySPR';

// 获取飞书 tenant_access_token
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
                        console.error('获取 token 失败:', result);
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

// 发送飞书消息
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

// 调用 Xero API
async function createInvoice(customerName, customerEmail, qty) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            customer_name: customerName,
            customer_email: customerEmail,
            qty: parseInt(qty)
        });

        console.log('调用 Xero API:', {
            url: 'https://xero-invoice-bot.onrender.com/create-invoice',
            data: JSON.parse(postData)
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
            console.log('Xero API 响应状态:', res.statusCode);
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Xero API 响应数据:', data);
                try {
                    const result = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(result);
                    } else {
                        resolve({ 
                            error: true, 
                            statusCode: res.statusCode,
                            message: result.message || result.error || 'API调用失败',
                            raw: data
                        });
                    }
                } catch (e) {
                    resolve({ 
                        error: true, 
                        statusCode: res.statusCode,
                        message: '解析响应失败',
                        raw: data 
                    });
                }
            });
        });

        req.on('error', (err) => {
            console.error('Xero API 请求错误:', err);
            reject(err);
        });
        req.setTimeout(30000);
        req.write(postData);
        req.end();
    });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // 健康检查
    if (parsedUrl.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'running', 
            service: 'xero-feishu-bridge',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // 飞书回调
    if (parsedUrl.pathname === '/feishu' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                console.log('收到飞书请求:', JSON.stringify(data, null, 2));

                // 处理 challenge 验证
                if (data.challenge) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ challenge: data.challenge }));
                    return;
                }

                // 处理消息事件
                const event = data.event || {};
                const message = event.message || {};
                const contentStr = message.content || '';

                // 解析消息内容
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

                // 处理开票指令
                if (text.startsWith('开票')) {
                    const parts = text.split(' ');
                    
                    if (parts.length === 4) {
                        const [, name, email, qty] = parts;
                        
                        try {
                            // 调用 Xero API
                            console.log(`创建发票: ${name}, ${email}, ${qty}`);
                            const result = await createInvoice(name, email, qty);
                            console.log('Xero API 返回:', result);

                            let invoiceNumber, status;
                            if (result.error) {
                                invoiceNumber = `失败(${result.statusCode})`;
                                status = result.message || '未知错误';
                            } else if (result.invoice_error_status) {
                                // Xero API 返回了错误状态
                                invoiceNumber = '失败';
                                if (result.invoice_raw && result.invoice_raw.includes('TokenExpired')) {
                                    status = 'Xero令牌过期，请联系管理员';
                                } else if (result.invoice_raw) {
                                    try {
                                        const errorData = JSON.parse(result.invoice_raw);
                                        status = errorData.Detail || errorData.Title || 'Xero API错误';
                                    } catch (e) {
                                        status = 'Xero API错误';
                                    }
                                } else {
                                    status = 'Xero API错误';
                                }
                            } else {
                                invoiceNumber = result.invoice_number || '失败';
                                status = result.email_status || '未知';
                            }

                            // 获取 token 并回复
                            const token = await getTenantToken();
                            const chatId = message.chat_id;
                            const replyText = `开票完成：${invoiceNumber} 邮件状态:${status}`;
                            
                            const sendResult = await sendFeishuMessage(chatId, replyText, token);
                            console.log('发送消息结果:', sendResult);

                        } catch (error) {
                            console.error('处理开票请求时出错:', error);
                            
                            // 发送错误消息
                            try {
                                const token = await getTenantToken();
                                const chatId = message.chat_id;
                                await sendFeishuMessage(chatId, `开票处理失败: ${error.message}`, token);
                            } catch (e) {
                                console.error('发送错误消息失败:', e);
                            }
                        }
                    } else {
                        // 格式错误
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

    // 404
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

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    server.close(() => {
        console.log('服务已关闭');
        process.exit(0);
    });
});
