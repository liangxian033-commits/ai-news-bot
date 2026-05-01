const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();

// 从环境变量读取 Token，防止源码泄露
const PUSHPLUS_TOKEN = process.env.PUSH_TOKEN; 

async function sendWechatMessage(title, content) {
    try {
        await axios.post('http://www.pushplus.plus/send', {
            token: PUSHPLUS_TOKEN,
            title: title,
            content: content,
            channel: 'wechat',
            template: 'markdown'
        });
        console.log('✅ 微信推送成功');
    } catch (error) {
        console.error('❌ 推送失败:', error.message);
    }
}

async function runJavisRobot() {
    try {
        // 云端直连 TechCrunch
        const RSS_URL = 'https://techcrunch.com/category/artificial-intelligence/feed/';
        const feed = await parser.parseURL(RSS_URL);

        let markdownContent = `### 🤖 贾维斯全球 AI 简报\n\n> 自动云端发送：\n\n---\n\n`;
        feed.items.slice(0, 5).forEach((item, index) => {
            markdownContent += `#### ${index + 1}. ${item.title}\n`;
            markdownContent += `[🔗 Read Full](${item.link})\n\n---\n\n`;
        });

        await sendWechatMessage('今日 AI 简报', markdownContent);
    } catch (error) {
        console.error('❌ 抓取失败:', error.message);
    }
}

runJavisRobot();