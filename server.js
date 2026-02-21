const http = require('http');
const https = require('https');
const url = require('url');

// Render 使用 PORT 环境变量，本地开发默认 5001
const PORT = process.env.PORT || 5001;
const XERO_API = 'https://xero-invoice-bot.onrender.com/create-invoice';
const APP_ID = 'cli_a9139fddafb89bb5';
const APP_SECRET = 'BaChzUHA3iAPfddnIJ4T1eqvPqCMySPR';
const MOONSHOT_API_KEY = 'sk-9ELqQcQuflGPjhVZYt8mAiQPf6KXvjjO2wdmzcTTyBdsEFp1';

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

// ===============================
// Kimi AI 调用
// ===============================
async function callKimiAI(userMessage) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: "kimi-k2.5",
            messages: [
                {
                    role: "system",
                    content: `你是一个Xero财务助手。请分析用户的自然语言输入，提取意图和参数。

可用操作：
1. create_invoice - 创建发票
2. query_receivables - 查询应收账款
3. help - 帮助信息
4. unknown - 无法理解

预设客户映射：
${Object.entries(CUSTOMER_MAP).map(([k, v]) => `- "${k}" -> ${v.name} (${v.email})`).join('\n')}

请返回严格的JSON格式（不要有任何其他文字）：
{
    "action": "create_invoice|query_receivables|help|unknown",
    "customer_name": "客户名称（如果提到）",
    "customer_alias": "客户简称（如果匹配预设）",
    "email": "邮箱（如果提供）",
    "quantity": 数量（数字，如果提到）,
    "confidence": 0.0-1.0,
    "response": "对用户的友好回复（如果不需要执行操作）"
}`
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const options = {
            hostname: 'api.moonshot.cn',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MOONSHOT_API_KEY}`,
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
                    if (result.choices && result.choices[0]) {
                        const content = result.choices[0].message.content;
                        resolve(JSON.parse(content));
                    } else {
                        reject(new Error('Invalid AI response'));
                    }
                } catch (e) {
                    console.error('AI解析错误:', e, data);
                    reject(e);
                }
            });
        });

        req.on('error', (err) => {
            console.error('AI请求错误:', err);
            reject(err);
        });
        req.setTimeout(30000);
        req.write(postData);
        req.end();
    });
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

// ===============================
// 智能消息处理（使用 AI）
// ===============================
async function processMessageWithAI(text, chatId, token) {
    try {
        console.log('调用 Kimi AI 分析:', text);
        const aiResult = await callKimiAI(text);
        console.log('AI 分析结果:', aiResult);

        // 根据 AI 分析结果执行操作
        switch (aiResult.action) {
            case 'create_invoice':
                return await handleCreateInvoice(aiResult, chatId, token);
            
            case 'query_receivables':
                return await handleQueryReceivables(chatId, token);
            
            case 'help':
                await sendFeishuMessage(chatId, aiResult.response || getHelpText(), token);
                return true;
            
            case 'unknown':
                await sendFeishuMessage(chatId, aiResult.response || '抱歉，我不太理解您的意思。输入"帮助"查看可用命令。', token);
                return true;
            
            default:
                // 回退到传统指令解析
                return false;
        }
    } catch (error) {
        console.error('AI 处理失败:', error);
        // AI 失败时回退到传统解析
        return false;
    }
}

// 处理创建发票
async function handleCreateInvoice(aiResult, chatId, token) {
    let customerName = aiResult.customer_name;
    let customerEmail = aiResult.email;
    let qty = aiResult.quantity;

    // 如果 AI 识别了客户别名，使用映射表
    if (aiResult.customer_alias && CUSTOMER_MAP[aiResult.customer_alias]) {
        const mapped = CUSTOMER_MAP[aiResult.customer_alias];
        customerName = mapped.name;
        customerEmail = mapped.email;
    }

    // 验证必要参数
    if (!customerName || !qty) {
        await sendFeishuMessage(chatId, '请提供客户名称和数量。例如："给 Ray 开 100 箱发票"', token);
        return true;
    }

    // 如果没有邮箱，尝试从映射表查找
    if (!customerEmail) {
        const alias = Object.keys(CUSTOMER_MAP).find(k => 
            CUSTOMER_MAP[k].name.toLowerCase() === customerName.toLowerCase()
        );
        if (alias) {
            customerEmail = CUSTOMER_MAP[alias].email;
        }
    }

    if (!customerEmail) {
        await sendFeishuMessage(chatId, `请提供 ${customerName} 的邮箱地址。例如："给 ${customerName} (email@example.com) 开 100 箱发票"`, token);
        return true;
    }

    // 创建发票
    try {
        const result = await createInvoice(customerName, customerEmail, qty);
        
        let replyText;
        if (result.error) {
            replyText = `开票失败: ${result.message || '未知错误'}`;
        } else if (result.invoice_error_status) {
            replyText = `开票失败: ${result.invoice_raw || 'Xero API 错误'}`;
        } else {
            replyText = `✅ 开票成功！\n发票号: ${result.invoice_number}\n客户: ${customerName}\n数量: ${qty}箱\n邮件状态: ${result.email_status}`;
        }
        
        await sendFeishuMessage(chatId, replyText, token);
        return true;
    } catch (error) {
        await sendFeishuMessage(chatId, `开票处理失败: ${error.message}`, token);
        return true;
    }
}

// 处理查询应收
async function handleQueryReceivables(chatId, token) {
    try {
        const summary = await getReceivablesSummary();
        
        let replyText;
        if (summary.error) {
            replyText = `查询失败: ${summary.error}`;
        } else {
            replyText = `📊 应收账款汇总\n\n` +
                `总应收: $${summary.total_outstanding?.toFixed(2) || 0}\n` +
                `发票总数: ${summary.total_invoices || 0}\n` +
                `逾期发票: ${summary.overdue_invoices || 0}\n` +
                `逾期金额: $${summary.overdue_amount?.toFixed(2) || 0}\n\n`;
            
            if (summary.by_customer && Object.keys(summary.by_customer).length > 0) {
                replyText += `按客户统计:\n`;
                for (const [name, data] of Object.entries(summary.by_customer)) {
                    replyText += `- ${name}: ${data.count}张, $${data.amount?.toFixed(2) || 0}\n`;
                }
            }
        }
        
        await sendFeishuMessage(chatId, replyText, token);
        return true;
    } catch (error) {
        await sendFeishuMessage(chatId, `查询失败: ${error.message}`, token);
        return true;
    }
}

// 获取帮助文本
function getHelpText() {
    return `🤖 Xero 智能财务助手\n\n` +
        `💡 您可以这样跟我说:\n` +
        `• "给 Ray 开 100 箱葡萄发票"\n` +
        `• "ABC Trading Ltd 需要 50 箱"\n` +
        `• "查询一下应收账款"\n` +
        `• "谁还欠我们钱"\n\n` +
        `📋 预设客户:\n` +
        Object.entries(CUSTOMER_MAP).map(([k, v]) => `• ${k} → ${v.name}`).join('\n');
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
            ai_enabled: true,
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

                // 获取飞书 token
                const token = await getTenantToken();
                const chatId = message.chat_id;

                // 立即响应飞书（避免超时）
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'processing' }));

                // 异步处理消息（在响应之后）
                processMessageWithAI(text, chatId, token).then(handled => {
                    if (!handled) {
                        sendFeishuMessage(chatId, getHelpText(), token);
                    }
                }).catch(err => {
                    console.error('异步处理失败:', err);
                    sendFeishuMessage(chatId, '处理失败，请稍后重试', token);
                });

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
    console.log(`Xero-Feishu Bridge with AI running on port ${PORT}`);
    console.log('Kimi AI enabled!');
});
