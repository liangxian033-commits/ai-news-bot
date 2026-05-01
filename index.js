const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio'); 

const parser = new Parser({
    customFields: { item: ['content:encoded'] } 
});

const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 新增：休眠函数，用于控制发送节奏
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 1. 调用 DeepSeek 大模型进行翻译和总结
// ==========================================
async function translateAndSummarize(text) {
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
                    content: text.substring(0, 6000) 
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
        console.error('❌ DeepSeek 大脑短路:', error.response ? JSON.stringify(error.response.data) : error.message);
        return '翻译失败，请检查 API Key 或重试。';
    }
}

// ==========================================
// 2. 发送飞书精美高级卡片
// ==========================================
async function sendToFeishu(title, content, link) {
    try {
        const cardMessage = {
            msg_type: "interactive",
            card: {
                header: {
                    title: { tag: "plain_text", content: "🤖 汪宇涵臭狗 为您播报 AI 新闻" },
                    template: "blue"
                },
                elements: [
                    { tag: "markdown", content: `**${title}**\n\n---\n${content}\n\n[🔗 点击阅读 TechCrunch 英文原文](${link})` }
                ]
            }
        };

        await axios.post(FEISHU_WEBHOOK, cardMessage);
        console.log(`✅ 发送成功: ${title}`);
    } catch (error) {
        console.error('❌ 飞书发送失败:', error.message);
    }
}

// ==========================================
// 3. 核心流程控制 (升级版：循环处理 10 条)
// ==========================================
async function runJavisRobot() {
    console.log('🌍 机器人已苏醒，正在前往 TechCrunch 获取最新资讯...');
    try {
        if (!FEISHU_WEBHOOK || !DEEPSEEK_API_KEY) {
            throw new Error("找不到秘钥！请确认 GitHub Secrets 设置正确。");
        }

        const RSS_URL = 'https://techcrunch.com/category/artificial-intelligence/feed/';
        const feed = await parser.parseURL(RSS_URL);

        // 确定要抓取的数量，设定上限为 10，如果当天新闻不足 10 条，就按实际数量来
        const maxItems = Math.min(10, feed.items.length);
        console.log(`📰 发现 ${feed.items.length} 条新闻，准备处理前 ${maxItems} 条...\n`);

        // 使用 for 循环，一条一条处理
        for (let i = 0; i < maxItems; i++) {
            const article = feed.items[i];
            console.log(`⏳ [${i + 1}/${maxItems}] 正在处理: ${article.title}`);
            console.log('🧠 正在呼叫 DeepSeek AI 大脑分析...');

            const htmlContent = article['content:encoded'] || article.content || '';
            const $ = cheerio.load(htmlContent);
            const pureText = $.text().trim();

            if (!pureText) {
                console.error(`❌ 第 ${i + 1} 条未能提取到正文，跳过`);
                continue; // 提取失败则直接跳到下一篇
            }

            const translatedContent = await translateAndSummarize(pureText);
            await sendToFeishu(article.title, translatedContent, article.link);

            // 如果不是最后一条，就休息 3 秒，防止被飞书和 API 封禁
            if (i < maxItems - 1) {
                console.log('⏱️ 休息 3 秒，防止触发频率限制...\n');
                await sleep(3000);
            }
        }

        console.log('\n🎉 今日 10 条科技简报全部派送完毕！');

    } catch (error) {
        console.error('❌ 机器人运行报错:', error.message);
    }
}

// 启动！
runJavisRobot();
