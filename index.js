const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio'); // 用于清洗网页，提取纯文本

const parser = new Parser({
    customFields: { item: ['content:encoded'] } // 强行获取 RSS 里的超长正文
});

// 安全读取 GitHub 保险柜里的钥匙
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// ==========================================
// 1. 调用 DeepSeek 大模型进行翻译和总结
// ==========================================
async function translateAndSummarize(text) {
    console.log('🧠 正在呼叫 DeepSeek AI 大脑进行分析与翻译...');
    try {
        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: '你是一个资深的 AI 科技媒体主编。请按以下格式处理输入的英文文章：\n1. 【核心摘要】：用3-4句话总结这篇文章最核心的技术或商业价值。\n2. 【深度翻译】：将正文翻译成流畅的中文。如果原文太长，请精简废话，保留核心事实。'
                },
                {
                    role: 'user',
                    content: text.substring(0, 6000) // 截取前 6000 个字符防止超出模型限制
                }
            ],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        // 如果 API 报错，会在这里打印出具体原因
        console.error('❌ DeepSeek 大脑短路:', error.response ? JSON.stringify(error.response.data) : error.message);
        return '翻译失败，请检查 API Key 或重试。';
    }
}

// ==========================================
// 2. 发送飞书精美高级卡片
// ==========================================
async function sendToFeishu(title, content, link) {
    console.log('🚀 正在排版并发送至飞书...');
    try {
        const cardMessage = {
            msg_type: "interactive",
            card: {
                header: {
                    title: { tag: "plain_text", content: "🤖 贾维斯 AI 深度解析" },
                    template: "blue"
                },
                elements: [
                    { tag: "markdown", content: `**${title}**\n\n---\n${content}\n\n[🔗 点击阅读 TechCrunch 英文原文](${link})` }
                ]
            }
        };

        await axios.post(FEISHU_WEBHOOK, cardMessage);
        console.log('✅ 飞书卡片发送成功！');
    } catch (error) {
        console.error('❌ 飞书发送失败:', error.message);
    }
}

// ==========================================
// 3. 核心流程控制
// ==========================================
async function runJavisRobot() {
    console.log('🌍 贾维斯已苏醒，正在前往 TechCrunch 获取头条...');
    try {
        // 检查有没有配置秘钥
        if (!FEISHU_WEBHOOK || !DEEPSEEK_API_KEY) {
            throw new Error("找不到秘钥！请确认 GitHub Secrets 里的 FEISHU_WEBHOOK 和 DEEPSEEK_API_KEY 是否设置正确。");
        }

        const RSS_URL = 'https://techcrunch.com/category/artificial-intelligence/feed/';
        const feed = await parser.parseURL(RSS_URL);

        // 每天只精译一篇“今日头条”
        const topArticle = feed.items[0];
        console.log(`📰 锁定今日头条: ${topArticle.title}`);

        // 提取并清洗正文文本
        const htmlContent = topArticle['content:encoded'] || topArticle.content || '';
        const $ = cheerio.load(htmlContent);
        const pureText = $.text().trim();

        if (!pureText) {
            console.error('❌ 未能提取到文章正文');
            return;
        }

        // 送入大模型翻译
        const translatedContent = await translateAndSummarize(pureText);

        // 推送飞书
        await sendToFeishu(topArticle.title, translatedContent, topArticle.link);

    } catch (error) {
        console.error('❌ 机器人运行报错:', error.message);
    }
}

// 启动！
runJavisRobot();
