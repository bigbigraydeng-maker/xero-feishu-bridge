import requests
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

# Xero API 地址
XERO_API = "https://xero-invoice-bot.onrender.com/create-invoice"

# 飞书企业应用凭证
APP_ID = "cli_a9139fddafb89bb5"
APP_SECRET = "BaChzUHA3iAPfddnIJ4T1eqvPqCMySPR"


def get_tenant_token():
    """获取飞书 tenant_access_token"""
    resp = requests.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/",
        json={
            "app_id": APP_ID,
            "app_secret": APP_SECRET
        }
    )
    data = resp.json()
    if data.get("code") == 0:
        return data["tenant_access_token"]
    else:
        print(f"获取 token 失败: {data}")
        return None


def send_feishu_message(chat_id, text, token):
    """发送飞书消息"""
    resp = requests.post(
        "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "receive_id": chat_id,
            "msg_type": "text",
            "content": json.dumps({"text": text})
        }
    )
    return resp.json()


@app.route("/feishu", methods=["POST"])
def feishu():
    data = request.json
    print("收到飞书请求:", data)

    # 处理飞书 challenge 验证（首次配置时需要）
    if "challenge" in data:
        return jsonify({"challenge": data["challenge"]})

    # 处理消息事件
    event = data.get("event", {})
    message = event.get("message", {})
    content_str = message.get("content", "")

    # 解析消息内容
    text = ""
    if content_str:
        try:
            content_obj = json.loads(content_str)
            text = content_obj.get("text", "")
        except json.JSONDecodeError:
            text = content_str

    print(f"解析到的文本: {text}")

    # 处理开票指令
    if text.startswith("开票"):
        parts = text.split(" ")

        if len(parts) == 4:
            _, name, email, qty = parts

            try:
                # 调用 Xero API 创建发票
                response = requests.post(
                    XERO_API,
                    json={
                        "customer_name": name,
                        "customer_email": email,
                        "qty": int(qty)
                    },
                    timeout=30
                )

                result = response.json()
                print(f"Xero API 返回: {result}")

                invoice_number = result.get("invoice_number", "失败")
                status = result.get("email_status", "未知")

                # 获取飞书 token 并回复消息
                token = get_tenant_token()
                if token:
                    chat_id = message.get("chat_id", "")
                    reply_text = f"开票完成：{invoice_number} 邮件状态:{status}"
                    send_result = send_feishu_message(chat_id, reply_text, token)
                    print(f"发送消息结果: {send_result}")
                else:
                    print("无法获取飞书 token")

            except Exception as e:
                print(f"处理开票请求时出错: {e}")
                # 尝试发送错误消息
                token = get_tenant_token()
                if token:
                    chat_id = message.get("chat_id", "")
                    send_feishu_message(chat_id, f"开票处理失败: {str(e)}", token)
        else:
            # 格式不正确，回复使用说明
            token = get_tenant_token()
            if token:
                chat_id = message.get("chat_id", "")
                send_feishu_message(
                    chat_id,
                    "格式错误。使用方法：开票 客户名 邮箱 数量\n例如：开票 ABC abc@email.com 2",
                    token
                )

    return jsonify({"status": "ok"})


@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "running", "service": "xero-feishu-bridge"})


if __name__ == "__main__":
    print("Starting Xero-Feishu Bridge on port 5001...")
    print(f"Xero API: {XERO_API}")
    print(f"Feishu App ID: {APP_ID}")
    app.run(host="0.0.0.0", port=5001, debug=True)
