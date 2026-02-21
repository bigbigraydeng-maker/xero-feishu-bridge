const http = require('http');
const https = require('https');
const url = require('url');

// Render 使用 PORT 环境变量，本地开发默认 5001
const PORT = process.env.PORT || 5001;
const XERO_API = 'https://xero-invoice-bot.onrender.com/create-invoice';
const APP_ID = 'cli_a9139fddafb89bb5';
const APP_SECRET = 'BaChzUHA3iAPfddnIJ4T1eqvPqCMySPR';

// 客户名称映射表（简化名称 -> 完整信息）
const CUSTOMER_MAP = {
    'ray': { name: 'Ray Trading Ltd', email: 'raydeng923@gmail.com' },
    'abc': { name: 'ABC Trading Limited', email: 'abc@example.com' },
    'test': { name: 'Test Company Ltd', email: 'test@example.com' },
    // 可以在这里添加更多客户
};

// 消息去重缓存
const processedMessages = new Set();
const MESSAGE_CACHE_SIZE = 100;

function cleanOldMessages() {
    if (processedMessages.size > MESSAGE_CACHE_SIZE) {
        const entries = Array.from(processedMessages);
        processedMessages.clear();
        entries.slice(-MESSAGE_CACHE_SIZE).forEach(entry => processedMessages.add(entry));
    }
}

function isMessageProcessed(messageId) {
    return processedMessages.has(messageId);
}

function markMessageProcessed(messageId) {
    processedMessages.add(messageId);
    cleanOldMessages();
}

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
            chat_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text })
        });

        const options = {
            hostname: 'open.feishu.cn',
            path: '/open-apis/message/v4/send/',
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
                    resolve({ error: data });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 调用 Xero API 创建发票
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

// 查询 Xero 应收总额
async function getReceivablesSummary() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'xero-invoice-bot.onrender.com',
            path: '/receivables-summary',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: '解析失败', raw: data });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000);
        req.end();
    });
}

// 解析开票指令
// 支持格式：
// 1. 开票 客户名 数量（使用映射表）
// 2. 开票 客户名 邮箱 数量（完整信息）
// 3. 开票 "客户全名" 邮箱 数量（带空格的客户名）
function parseInvoiceCommand(text) {
    // 去掉"开票"前缀并trim
    const content = text.substring(2).trim();
    
    // 尝试匹配带引号的客户名：开票 "ABC Trading Ltd" email 100
    const quotedMatch = content.match(/^"([^"]+)"\s+(\S+)\s+(\d+)$/);
    if (quotedMatch) {
        return {
            name: quotedMatch[1],
            email: quotedMatch[2],
            qty: parseInt(quotedMatch[3])
        };
    }
    
    // 尝试匹配简单格式：开票 客户名 数量
    const simpleParts = content.split(/\s+/);
    
    if (simpleParts.length === 2) {
        // 格式：开票 客户名 数量
        const alias = simpleParts[0].toLowerCase();
        const qty = parseInt(simpleParts[1]);
        
        if (CUSTOMER_MAP[alias]) {
            return {
                name: CUSTOMER_MAP[alias].name,
                email: CUSTOMER_MAP[alias].email,
                qty: qty
            };
        }
    } else if (simpleParts.length >= 3) {
        // 格式：开票 客户名 邮箱 数量
        // 客户名可能包含空格，但邮箱和数量在最后
        const qty = parseInt(simpleParts[simpleParts.length - 1]);
        const email = simpleParts[simpleParts.length - 2];
        const name = simpleParts.slice(0, simpleParts.length - 2).join(' ');
        
        if (!isNaN(qty) && email.includes('@')) {
            return { name, email, qty };
        }
    }
    
    return null;
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
                const messageId = message.message_id || '';

                // 消息去重检查
                if (messageId && isMessageProcessed(messageId)) {
                    console.log(`消息 ${messageId} 已处理，跳过`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'duplicate' }));
                    return;
                }

                // 标记消息为已处理
                if (messageId) {
                    markMessageProcessed(messageId);
                }

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
                    const parsed = parseInvoiceCommand(text);
                    
                    if (parsed) {
                        const { name, email, qty } = parsed;
                        
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
                            const helpText = `格式错误。使用方法：\n` +
                                `1. 开票 客户名 数量（使用预设客户）\n` +
                                `   例如：开票 ray 100\n\n` +
                                `2. 开票 "客户全名" 邮箱 数量（新客户）\n` +
                                `   例如：开票 "ABC Trading Ltd" abc@email.com 2\n\n` +
                                `3. 开票 客户名 邮箱 数量（简单格式）\n` +
                                `   例如：开票 ABC abc@email.com 2\n\n` +
                                `预设客户：${Object.keys(CUSTOMER_MAP).join(', ')}`;
                            await sendFeishuMessage(chatId, helpText, token);
                        } catch (e) {
                            console.error('发送帮助消息失败:', e);
                        }
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                    return;
                }

                // 处理应收查询指令
                if (text === '应收汇总' || text === '应收账款') {
                    try {
                        const summary = await getReceivablesSummary();
                        const token = await getTenantToken();
                        const chatId = message.chat_id;
                        
                        let replyText;
                        if (summary.error) {
                            replyText = `查询失败: ${summary.error}`;
                        } else {
                            replyText = `应收汇总:\n${JSON.stringify(summary, null, 2)}`;
                        }
                        
                        await sendFeishuMessage(chatId, replyText, token);
                    } catch (error) {
                        console.error('查询应收失败:', error);
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                    return;
                }

                // 其他消息
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ignored' }));

            } catch (error) {
                console.error('处理飞书请求时出错:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`Xero-Feishu Bridge running on port ${PORT}`);
    console.log('支持的命令格式：');
    console.log('1. 开票 客户名 数量（使用预设客户）');
    console.log('2. 开票 "客户全名" 邮箱 数量（新客户）');
    console.log('3. 应收汇总（查询应收账款）');
});
