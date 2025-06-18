import { serve } from "https://deno.land/std/http/server.ts";

const apiMapping = {
  "/discord": "https://discord.com/api",
  "/telegram": "https://api.telegram.org",
  "/openai": "https://api.openai.com",
  "/claude": "https://api.anthropic.com",
  "/gemini": "https://generativelanguage.googleapis.com",
  "/gemininthk": "https://generativelanguage.googleapis.com",
  "/meta": "https://www.meta.ai/api",
  "/groq": "https://api.groq.com/openai",
  "/xai": "https://api.x.ai",
  "/cohere": "https://api.cohere.ai",
  "/huggingface": "https://api-inference.huggingface.co",
  "/together": "https://api.together.xyz",
  "/novita": "https://api.novita.ai",
  "/portkey": "https://api.portkey.ai",
  "/fireworks": "https://api.fireworks.ai",
  "/openrouter": "https://openrouter.ai/api",
};

// Stats storage
const stats = {
  total: 0,
  endpoints: {} as Record<string, { total: number; today: number; week: number; month: number }>,
  requests: [] as Array<{ endpoint: string; timestamp: number }>
};

// Initialize stats
for (const endpoint of Object.keys(apiMapping)) {
  stats.endpoints[endpoint] = {
    total: 0,
    today: 0, // Aggregated count for last 24h
    week: 0,  // Aggregated count for last 7d
    month: 0  // Aggregated count for last 30d
  };
}

function recordRequest(endpoint) {
  const now = Date.now();
  stats.total++;
  stats.endpoints[endpoint].total++;
  stats.requests.push({ endpoint, timestamp: now });
  
  // Clean up old requests (older than 30 days)
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  stats.requests = stats.requests.filter(req => req.timestamp > thirtyDaysAgo);
  
  updateSummaryStats(); // Update summary stats like today, week, month totals
}

function updateSummaryStats() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  for (const endpointKey of Object.keys(stats.endpoints)) {
    stats.endpoints[endpointKey].today = 0;
    stats.endpoints[endpointKey].week = 0;
    stats.endpoints[endpointKey].month = 0;
  }

  for (const req of stats.requests) {
    const endpointStats = stats.endpoints[req.endpoint];
    if (!endpointStats) continue; // Should not happen if initialized correctly

    if (req.timestamp > oneDayAgo) {
      endpointStats.today++;
    }
    if (req.timestamp > sevenDaysAgo) {
      endpointStats.week++;
    }
    if (req.timestamp > thirtyDaysAgo) { // This will always be true due to cleanup, but good for clarity
      endpointStats.month++;
    }
  }
}


function generateStatsHTML(request) {
  updateSummaryStats(); // Ensure summary stats are up-to-date
  
  const url = new URL(request.url);
  const currentDomain = `${url.protocol}//${url.host}`;
  
  const openaiStats = stats.endpoints["/openai"] || { today: 0, week: 0, month: 0, total: 0 };
  const geminiStats = stats.endpoints["/gemini"] || { today: 0, week: 0, month: 0, total: 0 };
  const claudeStats = stats.endpoints["/claude"] || { today: 0, week: 0, month: 0, total: 0 };
  const xaiStats = stats.endpoints["/xai"] || { today: 0, week: 0, month: 0, total: 0 };
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API代理服务器 - 统计面板</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { text-align: center; color: white; margin-bottom: 40px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .chart-section { background: rgba(255, 255, 255, 0.95); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 40px; }
        .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .chart-title { font-size: 1.5rem; color: #333; font-weight: 600; }
        .time-tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .time-tab { padding: 8px 16px; border: none; background: transparent; border-radius: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; color: #64748b; transition: all 0.3s ease; }
        .time-tab.active { background: #6366f1; color: white; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3); }
        .time-tab:hover:not(.active) { background: #e2e8f0; color: #334155; }
        .chart-container { position: relative; height: 400px; margin-bottom: 20px; }
        .chart-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px; }
        .stat-card { background: rgba(255, 255, 255, 0.95); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .stat-card:hover { transform: translateY(-5px); box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15); }
        .stat-card h3 { font-size: 1.2rem; color: #333; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .api-icon { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white; }
        .openai-icon { background: #10a37f; } .gemini-icon { background: #4285f4; } .claude-icon { background: #d97706; } .xai-icon { background: #000000; } .total-icon { background: #6366f1; }
        .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee; }
        .stat-row:last-child { border-bottom: none; }
        .stat-label { color: #666; font-size: 0.9rem; }
        .stat-value { font-size: 1.1rem; font-weight: 600; color: #333; }
        .usage-guide { background: rgba(255, 255, 255, 0.95); border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .usage-guide h2 { color: #333; margin-bottom: 20px; font-size: 1.5rem; }
        .endpoint-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin: 20px 0; }
        .endpoint-item { background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #6366f1; transition: all 0.3s ease; cursor: pointer; }
        .endpoint-item:hover { background: #f1f5f9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        .endpoint-path { font-weight: bold; color: #6366f1; margin-bottom: 4px; font-family: 'Courier New', monospace; }
        .endpoint-url { font-size: 0.8rem; color: #666; word-break: break-all; font-family: 'Courier New', monospace; }
        .example-section { margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; }
        .example-section h3 { color: #333; margin-bottom: 12px; }
        .code-block { background: #1a1a1a; color: #f8f8f2; padding: 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 0.9rem; overflow-x: auto; margin: 12px 0; white-space: pre-wrap; word-wrap: break-word; line-height: 1.4; }
        .refresh-btn { position: fixed; bottom: 30px; right: 30px; background: #6366f1; color: white; border: none; border-radius: 50px; padding: 12px 24px; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3); transition: all 0.3s ease; z-index: 1000; }
        .refresh-btn:hover { background: #5855eb; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }
        .toast { position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; font-size: 14px; z-index: 1001; opacity: 0; transform: translateX(100%); transition: all 0.3s ease; }
        .toast.show { opacity: 1; transform: translateX(0); }
        .chart-legend { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
        .legend-color { width: 12px; height: 12px; border-radius: 2px; }
        .legend-line { width: 16px; height: 3px; border-radius: 2px; }
        .no-data { text-align: center; color: #64748b; font-style: italic; padding: 40px 0; }
        .chart-info { background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #6366f1; }
        .chart-info p { color: #64748b; font-size: 0.9rem; margin: 0; }
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: 1fr; }
            .endpoint-list { grid-template-columns: 1fr; }
            .header h1 { font-size: 2rem; }
            .chart-grid { grid-template-columns: 1fr; }
            .chart-header { flex-direction: column; align-items: stretch; }
            .time-tabs { justify-self: stretch; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🚀 API代理服务器</h1><p>实时统计与使用指南</p></div>
        
        <div class="chart-section">
            <div class="chart-header">
                <h2 class="chart-title">📊 API调用统计图表</h2>
                <div class="time-tabs">
                    <button class="time-tab active" data-period="today">24小时</button>
                    <button class="time-tab" data-period="week">7天</button>
                    <button class="time-tab" data-period="month">30天</button>
                    <button class="time-tab" data-period="total">总计</button>
                </div>
            </div>
            <div class="chart-info"><p>📊 组合图表：蓝色柱状图显示总API调用次数，红色折线图显示总体调用趋势。选择上方时间范围查看不同维度数据。</p></div>
            <div class="chart-grid">
                <div class="chart-container"><canvas id="apiChart"></canvas></div>
                <div><div class="chart-legend" id="chartLegend"></div></div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card"><h3><div class="api-icon openai-icon">AI</div>OpenAI API 调用统计</h3><div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${openaiStats.today}</span></div><div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${openaiStats.week}</span></div><div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${openaiStats.month}</span></div><div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${openaiStats.total}</span></div></div>
            <div class="stat-card"><h3><div class="api-icon gemini-icon">G</div>Gemini API 调用统计</h3><div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${geminiStats.today}</span></div><div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${geminiStats.week}</span></div><div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${geminiStats.month}</span></div><div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${geminiStats.total}</span></div></div>
            <div class="stat-card"><h3><div class="api-icon claude-icon">C</div>Claude API 调用统计</h3><div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${claudeStats.today}</span></div><div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${claudeStats.week}</span></div><div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${claudeStats.month}</span></div><div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${claudeStats.total}</span></div></div>
            <div class="stat-card"><h3><div class="api-icon xai-icon">X</div>XAI API 调用统计</h3><div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${xaiStats.today}</span></div><div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${xaiStats.week}</span></div><div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${xaiStats.month}</span></div><div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${xaiStats.total}</span></div></div>
            <div class="stat-card"><h3><div class="api-icon total-icon">📊</div>总体统计</h3><div class="stat-row"><span class="stat-label">总请求数</span><span class="stat-value">${stats.total}</span></div><div class="stat-row"><span class="stat-label">活跃端点</span><span class="stat-value">${Object.keys(stats.endpoints).filter(k => stats.endpoints[k].total > 0).length}</span></div><div class="stat-row"><span class="stat-label">服务状态</span><span class="stat-value" style="color: #10b981;">🟢 运行中</span></div></div>
        </div>
        
        <div class="usage-guide">
            <h2>📖 使用说明</h2>
            <h3>支持的API端点</h3>
            <div class="endpoint-list">${Object.keys(apiMapping).map(endpoint => `<div class="endpoint-item" title="点击复制完整地址"><div class="endpoint-path">${endpoint}</div><div class="endpoint-url">${currentDomain}${endpoint}</div></div>`).join('')}</div>
            <div class="example-section">
                <h3>🔧 使用方法</h3><p style="margin-bottom: 16px; color: #666;">将原始API地址替换为代理地址，例如：</p>
                <h4 style="margin: 16px 0 8px 0; color: #333;">OpenAI API 示例：</h4><div class="code-block"># 原始地址\nhttps://api.openai.com/v1/chat/completions\n\n# 代理地址\n${currentDomain}/openai/v1/chat/completions</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">Gemini API 示例：</h4><div class="code-block"># 原始地址\nhttps://generativelanguage.googleapis.com/v1/models\n\n# 代理地址\n${currentDomain}/gemini/v1/models</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">Gemini NoThink API 示例：</h4><div class="code-block"># 原始地址\nhttps://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-thinking-exp:generateContent\n\n# 代理地址（自动禁用思考模式）\n${currentDomain}/gemininthk/v1/models/gemini-2.0-flash-thinking-exp:generateContent</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">Claude API 示例：</h4><div class="code-block"># 原始地址\nhttps://api.anthropic.com/v1/messages\n\n# 代理地址\n${currentDomain}/claude/v1/messages</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">XAI API 示例：</h4><div class="code-block"># 原始地址\nhttps://api.x.ai/v1/chat/completions\n\n# 代理地址\n${currentDomain}/xai/v1/chat/completions</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">cURL 示例：</h4><div class="code-block">curl -X POST ${currentDomain}/openai/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{\n    "model": "gpt-3.5-turbo",\n    "messages": [{"role": "user", "content": "Hello!"}]\n  }'</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">JavaScript 示例：</h4><div class="code-block">// 使用 fetch API\nconst response = await fetch('${currentDomain}/openai/v1/chat/completions', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': 'Bearer YOUR_API_KEY'\n  },\n  body: JSON.stringify({\n    model: 'gpt-3.5-turbo',\n    messages: [{ role: 'user', content: 'Hello!' }]\n  })\n});\n\nconst data = await response.json();\nconsole.log(data);</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">Python 示例：</h4><div class="code-block">import requests\n\nurl = "${currentDomain}/openai/v1/chat/completions"\nheaders = {\n    "Content-Type": "application/json",\n    "Authorization": "Bearer YOUR_API_KEY"\n}\ndata = {\n    "model": "gpt-3.5-turbo",\n    "messages": [{"role": "user", "content": "Hello!"}]\n}\n\nresponse = requests.post(url, headers=headers, json=data)\nprint(response.json())</div>
            </div>
            <div class="example-section"><h3>🌐 代理模式</h3><p style="margin-bottom: 16px; color: #666;">支持完整网页代理，可以直接在浏览器中访问被代理的网站：</p><div class="code-block"># 代理任意网站\n${currentDomain}/proxy/https://example.com\n\n# 代理API文档\n${currentDomain}/proxy/https://platform.openai.com/docs</div></div>
            <div class="example-section"><h3>⚡ 特性</h3><ul style="margin-left: 20px; color: #666; line-height: 1.6;"><li>✅ 支持所有HTTP方法 (GET, POST, PUT, DELETE等)</li><li>✅ 自动转发请求头和响应头</li><li>✅ 支持CORS跨域请求</li><li>✅ 实时统计API调用次数</li><li>✅ 代理模式支持完整网页浏览</li><li>✅ 自动获取当前域名，无需手动配置</li><li>✅ 组合图表展示调用统计和趋势</li><li>✅ Gemini NoThink模式：自动为Gemini请求添加thinkingBudget: 0禁用思考模式</li></ul></div>
            <div class="example-section"><h3>🔒 安全特性</h3><ul style="margin-left: 20px; color: #666; line-height: 1.6;"><li>🛡️ 设置安全响应头 (X-Frame-Options, X-Content-Type-Options等)</li><li>🛡️ 过滤和转发指定的请求头</li><li>🛡️ 禁止搜索引擎爬取 (robots.txt)</li><li>🛡️ 自动处理CORS预检请求</li></ul></div>
            <div class="example-section"><h3>📊 统计功能</h3><ul style="margin-left: 20px; color: #666; line-height: 1.6;"><li>📈 实时统计API调用次数</li><li>📈 支持多时间维度统计（24h/7d/30d/总计）</li><li>📈 重点监控OpenAI、Gemini、Claude和XAI API使用量</li><li>📈 提供JSON格式统计API: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${currentDomain}/stats</code></li><li>📈 组合图表展示，柱状图+折线图显示数据和趋势</li></ul></div>
        </div>
    </div>
    <button class="refresh-btn" onclick="location.reload()">🔄 刷新数据</button>
    <div id="toast" class="toast"></div>
    
    <script>
        const rawStatsData = ${JSON.stringify(stats)};
        let chartInstance = null;
        let currentPeriod = 'today';
        const barColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#64748b', '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#3b82f6'];

        function getChartDataForPeriod(period, allRequests, endpointDetails) {
            const now = Date.now();
            let labels = [];
            let aggregatedData = [];

            if (period === 'today') {
                const hourlyCounts = Array(24).fill(0);
                const firstHourTimestamp = new Date(now - 23 * 60 * 60 * 1000);
                firstHourTimestamp.setMinutes(0, 0, 0);

                for (let i = 0; i < 24; i++) {
                    const hour = new Date(firstHourTimestamp);
                    hour.setHours(firstHourTimestamp.getHours() + i);
                    labels.push(hour.getHours().toString().padStart(2, '0') + ':00');
                }

                const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
                allRequests.filter(req => req.timestamp >= twentyFourHoursAgo)
                    .forEach(req => {
                        const reqHour = new Date(req.timestamp);
                        // Find the correct bucket relative to the firstHourTimestamp
                        const diffHours = Math.floor((reqHour.getTime() - firstHourTimestamp.getTime()) / (60 * 60 * 1000));
                        if (diffHours >= 0 && diffHours < 24) {
                            hourlyCounts[diffHours]++;
                        }
                    });
                aggregatedData = hourlyCounts;
            } else if (period === 'week' || period === 'month') {
                const numDays = period === 'week' ? 7 : 30;
                const dailyCounts = Array(numDays).fill(0);
                const firstDayTimestamp = new Date(now);
                firstDayTimestamp.setDate(firstDayTimestamp.getDate() - (numDays - 1));
                firstDayTimestamp.setHours(0, 0, 0, 0);

                for (let i = 0; i < numDays; i++) {
                    const day = new Date(firstDayTimestamp);
                    day.setDate(firstDayTimestamp.getDate() + i);
                    labels.push(day.getFullYear() + '-' + (day.getMonth() + 1).toString().padStart(2, '0') + '-' + day.getDate().toString().padStart(2, '0'));
                }
                
                const periodStartTimestamp = firstDayTimestamp.getTime();
                allRequests.filter(req => req.timestamp >= periodStartTimestamp)
                    .forEach(req => {
                        const reqDay = new Date(req.timestamp);
                        reqDay.setHours(0,0,0,0);
                        const diffDays = Math.floor((reqDay.getTime() - firstDayTimestamp.getTime()) / (24 * 60 * 60 * 1000));
                        if (diffDays >= 0 && diffDays < numDays) {
                           dailyCounts[diffDays]++;
                        }
                    });
                aggregatedData = dailyCounts;
            } else if (period === 'total') {
                const activeEndpoints = Object.keys(endpointDetails).filter(ep => endpointDetails[ep].total > 0);
                labels = activeEndpoints.map(ep => ep.replace('/', ''));
                aggregatedData = activeEndpoints.map(ep => endpointDetails[ep].total);
            }
            return { labels, data: aggregatedData };
        }

        function createCombinedChart(period) {
            const ctx = document.getElementById('apiChart').getContext('2d');
            if (chartInstance) chartInstance.destroy();
            
            const chartData = getChartDataForPeriod(period, rawStatsData.requests, rawStatsData.endpoints);

            if (chartData.labels.length === 0) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.fillStyle = '#64748b'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
                ctx.fillText('暂无数据', ctx.canvas.width / 2, ctx.canvas.height / 2);
                updateLegend(period, { labels: [], barData: [] }); // Pass empty barData for legend
                return;
            }
            
            const xAxisTitle = period === 'total' ? 'API 端点' : (period === 'today' ? '小时 (过去24小时)' : '日期');

            const chartConfig = {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            type: 'bar',
                            label: 'API调用次数',
                            data: chartData.data,
                            backgroundColor: period === 'total' 
                                ? chartData.labels.map((_, i) => barColors[i % barColors.length] + 'B3') // B3 for ~70% opacity
                                : '#6366f1B3',
                            borderColor: period === 'total' 
                                ? chartData.labels.map((_, i) => barColors[i % barColors.length])
                                : '#6366f1',
                            borderWidth: 1.5,
                            yAxisID: 'y',
                            order: 2 // Ensure bars are behind the line
                        },
                        {
                            type: 'line',
                            label: '调用趋势',
                            data: chartData.data,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 2.5,
                            pointBackgroundColor: '#ef4444',
                            pointBorderColor: 'white',
                            pointBorderWidth: 1.5,
                            pointRadius: period === 'total' ? 4 : (period === 'today' ? 3 : 4),
                            pointHoverRadius: period === 'total' ? 6 : (period === 'today' ? 5 : 6),
                            fill: false,
                            tension: (period === 'today' || period === 'total') ? 0.1 : 0.3, // Smoother for daily
                            yAxisID: 'y', // Use the same Y-axis for simplicity
                            order: 1 // Ensure line is in front
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 20, font: { size: 12 } } },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.85)', titleColor: 'white', bodyColor: 'white',
                            borderColor: '#6366f1', borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) label += context.parsed.y + ' 次';
                                    
                                    if (period === 'total') {
                                        const total = chartData.data.reduce((a, b) => a + b, 0);
                                        if (total > 0) {
                                            const percentage = ((context.raw / total) * 100).toFixed(1);
                                            label += ' (' + percentage + '%)';
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: xAxisTitle, color: '#333', font: { weight: 'bold' } },
                            ticks: { color: '#64748b', maxRotation: period === 'month' ? 45 : 0, minRotation: 0 },
                            grid: { color: '#e2e8f0' }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#64748b', precision: 0 }, // Ensure whole numbers for counts
                            grid: { color: '#e2e8f0' },
                            title: { display: true, text: '调用次数', color: '#333', font: { weight: 'bold' } }
                        }
                        // Removed y1 axis for simplicity, both datasets use 'y'
                    },
                    animation: { duration: 800, easing: 'easeOutQuart' }
                }
            };
            chartInstance = new Chart(ctx, chartConfig);
            updateLegend(period, chartData);
        }

        function updateLegend(period, chartData) {
            const legendContainer = document.getElementById('chartLegend');
            legendContainer.innerHTML = ''; // Clear previous legend

            if (chartData.labels.length === 0) {
                legendContainer.innerHTML = '<div class="no-data">期间内无调用数据</div>';
                return;
            }

            if (period === 'total') {
                const totalOverall = chartData.data.reduce((sum, item) => sum + item, 0);
                const legendItemsHtml = chartData.labels.map((label, index) => {
                    const value = chartData.data[index];
                    const percentage = totalOverall > 0 ? ((value / totalOverall) * 100).toFixed(1) : 0;
                    return '<div class="legend-item">' +
                        '<div class="legend-color" style="background-color: ' + barColors[index % barColors.length] + '"></div>' +
                        '<span>' + label + ': ' + value + ' 次 (' + percentage + '%)</span>' +
                        '</div>';
                }).join('');
                legendContainer.innerHTML = legendItemsHtml;
            } else { // For 'today', 'week', 'month'
                const periodText = period === 'today' ? '24小时' : (period === 'week' ? '7天' : '30天');
                legendContainer.innerHTML = 
                    '<div class="legend-item">' +
                        '<div class="legend-color" style="background-color: #6366f1"></div>' +
                        '<span>总调用次数 (柱状)</span>' +
                    '</div>' +
                    '<div class="legend-item">' +
                        '<div class="legend-line" style="background-color: #ef4444"></div>' +
                        '<span>调用趋势 (折线)</span>' +
                    '</div>' +
                    '<p style="font-size: 0.85rem; color: #666; margin-top: 10px;">' +
                        '显示过去 ' + periodText + ' 的总调用数据。' +
                    '</p>';
            }
        }

        function switchPeriod(newPeriod) {
            currentPeriod = newPeriod;
            document.querySelectorAll('.time-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelector('[data-period="' + newPeriod + '"]').classList.add('active');
            createCombinedChart(currentPeriod);
        }

        setInterval(() => { location.reload(); }, 60000);

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message; toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 3000);
        }

        function copyToClipboard(text) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => showToast('已复制: ' + text), () => fallbackCopy(text));
            } else { fallbackCopy(text); }
        }
        function fallbackCopy(text) {
            const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); showToast('已复制: ' + text); } 
            catch (err) { showToast('复制失败'); }
            document.body.removeChild(ta);
        }

        document.addEventListener('DOMContentLoaded', function() {
            createCombinedChart(currentPeriod);
            document.querySelectorAll('.time-tab').forEach(tab => {
                tab.addEventListener('click', function() { switchPeriod(this.dataset.period); });
            });
            document.querySelectorAll('.endpoint-item').forEach(item => {
                item.addEventListener('click', function() {
                    const url = this.querySelector('.endpoint-url').textContent.trim();
                    copyToClipboard(url);
                    const originalBg = this.style.backgroundColor, originalBorder = this.style.borderLeftColor;
                    this.style.backgroundColor = '#dcfce7'; this.style.borderLeftColor = '#16a34a';
                    setTimeout(() => { this.style.backgroundColor = originalBg; this.style.borderLeftColor = originalBorder; }, 1000);
                });
            });
        });
    </script>
</body>
</html>`;
}

// Deno server logic (serve, recordRequest, apiMapping etc.) remains largely the same
// Ensure updateSummaryStats is called when generating HTML or if stats data is fetched via /stats API
serve(async (request) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/" || pathname === "/index.html") {
    return new Response(generateStatsHTML(request), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (pathname === "/stats") {
    updateSummaryStats(); // Make sure summary is up-to-date for the API
    return new Response(JSON.stringify(stats, null, 2), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // Allow CORS for stats API
      },
    });
  }
  
  // Proxy mode
  if (pathname.startsWith("/proxy/")) {
    try {
      const fullUrl = url.href;
      // Correctly extract targetUrl, considering potential query params in currentDomain part
      const proxyPathIndex = url.pathname.indexOf("/proxy/");
      const targetUrlString = url.pathname.substring(proxyPathIndex + "/proxy/".length) + url.search + url.hash;
      
      if (!targetUrlString || !targetUrlString.startsWith("http")) {
          return new Response("Invalid proxy URL. Must start with http:// or https:// after /proxy/", { status: 400 });
      }
      const targetUrl = new URL(targetUrlString);
      const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;


      const headers = new Headers();
      const allowedHeaders = ["accept", "content-type", "authorization", "user-agent", "accept-encoding", "accept-language", "cache-control", "pragma", "x-requested-with"];
      request.headers.forEach((value, key) => {
        if (allowedHeaders.includes(key.toLowerCase()) || key.toLowerCase().startsWith("sec-") || key.toLowerCase().startsWith("x-")) {
          headers.set(key, value);
        }
      });
      // Crucial for some sites to work, but be mindful of security implications if any
      if (request.headers.has("referer")) {
          headers.set("Referer", request.headers.get("referer").replace(url.origin, targetUrl.origin));
      }


      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        redirect: "manual" // Handle redirects manually if needed, or 'follow'
      });

      const responseHeaders = new Headers(response.headers);
      const origin = request.headers.get("Origin");
      if (origin) {
        responseHeaders.set("Access-Control-Allow-Origin", origin);
        responseHeaders.set("Access-Control-Allow-Credentials", "true");
      } else {
        responseHeaders.set("Access-Control-Allow-Origin", "*");
      }
      responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH");
      responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, " + allowedHeaders.join(", "));
      responseHeaders.set("Access-Control-Max-Age", "86400");
      
      // Security headers (can be adjusted)
      responseHeaders.set("X-Content-Type-Options", "nosniff");
      responseHeaders.delete("X-Frame-Options"); // Or set to SAMEORIGIN if proxying own content
      responseHeaders.set("Referrer-Policy", "no-referrer-when-downgrade"); // Common policy


      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: responseHeaders });
      }
      
      // Handle redirects by rewriting Location header
      if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
          let newLocation = response.headers.get("location");
          // If location is relative, prepend the target's base URL
          if (newLocation && newLocation.startsWith("/")) {
              newLocation = `${baseUrl}${newLocation}`;
          }
          // Rewrite the location to go through the proxy
          if (newLocation) {
              responseHeaders.set("Location", `${url.origin}/proxy/${newLocation}`);
          }
          return new Response(null, { status: response.status, headers: responseHeaders });
      }


      const contentType = responseHeaders.get("content-type") || "";
      if (contentType.includes("text/html")) {
        let text = await response.text();
        // Basic HTML rewriting (can be very complex for modern SPAs)
        const currentProxyBase = `${url.origin}/proxy/`;
        text = text.replace(/(href|src|action)=["']\/(?!\/)/gi, `$1="${currentProxyBase}${baseUrl}/`);
        text = text.replace(/(href|src|action)=["'](https?:\/\/[^"']+)/gi, (match, attr, originalUrl) => {
            return `${attr}="${currentProxyBase}${originalUrl}"`;
        });
        // Rewrite srcset
        text = text.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
            const newSrcset = srcset.split(',').map(s => {
                const parts = s.trim().split(/\s+/);
                let u = parts[0];
                if (u.startsWith('/')) u = `${baseUrl}${u}`;
                return `${currentProxyBase}${u}${parts[1] ? ' ' + parts[1] : ''}`;
            }).join(', ');
            return `srcset="${newSrcset}"`;
        });
        // Remove integrity attributes as content is modified
        text = text.replace(/\s+integrity=["'][^"']+["']/gi, '');
        // Attempt to fix base href if present
        text = text.replace(/<base\s+href=["']([^"']+)["'][^>]*>/gi, (match, baseHrefVal) => {
            let newBase = baseHrefVal;
            if(baseHrefVal.startsWith('/')) newBase = `${baseUrl}${baseHrefVal}`;
            return `<base href="${currentProxyBase}${newBase}">`;
        });


        return new Response(text, { status: response.status, headers: responseHeaders });
      } else if (contentType.includes("text/css")) {
        let text = await response.text();
        // Rewrite url() in CSS
        const currentProxyBase = `${url.origin}/proxy/`;
        text = text.replace(/url\(([^)]+)\)/gi, (match, cssUrl) => {
            let u = cssUrl.trim().replace(/["']/g, '');
            if (u.startsWith('data:') || u.startsWith('#')) return match; // Skip data URIs and fragments
            if (u.startsWith('/')) u = `${baseUrl}${u}`;
            else if (!u.startsWith('http')) u = `${new URL(u, targetUrl.toString()).href}`; // Resolve relative URLs
            return `url(${currentProxyBase}${u})`;
        });
        return new Response(text, { status: response.status, headers: responseHeaders });
      }


      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch (error) {
      console.error("Proxy request failed:", error.message, error.stack);
      return new Response("Proxy Request Failed: " + error.message, { status: 502 }); // Bad Gateway
    }
  }


  const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));
  if (!prefix) {
    return new Response("Not Found", { status: 404 });
  }

  recordRequest(prefix);
  const targetApiUrl = `${apiMapping[prefix]}${rest}${url.search}`;

  try {
    const headers = new Headers();
    // Forward specific headers, be selective for security
    const commonApiHeaders = ["content-type", "authorization", "accept", "anthropic-version"];
    request.headers.forEach((value, key) => {
        if (commonApiHeaders.includes(key.toLowerCase()) || key.toLowerCase().startsWith("x-")) {
            headers.set(key, value);
        }
    });
    
    // Add required headers for specific APIs
    if (prefix === "/claude" && !headers.has("anthropic-version")) {
        headers.set("anthropic-version", "2023-06-01");
    }
    
    // Add user-agent if not present, some APIs might require it
    if (!headers.has("user-agent")) {
        headers.set("user-agent", "Deno-API-Proxy/1.0");
    }

    // Handle special processing for gemininthk
    let requestBody: BodyInit | null = null;
    if (prefix === "/gemininthk" && request.method === "POST" && request.body && headers.get("content-type")?.includes("application/json")) {
      const originalBodyText = await request.text();
      if (originalBodyText) {
        const bodyJson = JSON.parse(originalBodyText);
        
        // Add thinkingBudget: 0 to disable thinking mode
        bodyJson.generationConfig = {
          ...(bodyJson.generationConfig || {}),
          thinkingConfig: {
            thinkingBudget: 0
          }
        };
        
        requestBody = JSON.stringify(bodyJson);
      } else {
        requestBody = null;
      }
    } else if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
      requestBody = request.body;
    }

    const apiResponse = await fetch(targetApiUrl, {
      method: request.method,
      headers: headers,
      body: requestBody,
    });

    const responseHeaders = new Headers(apiResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, anthropic-version, " + commonApiHeaders.join(", "));
    
    // Security headers
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-Frame-Options", "DENY"); // APIs shouldn't be framed
    responseHeaders.set("Referrer-Policy", "no-referrer");


    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    return new Response(apiResponse.body, {
      status: apiResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("API proxy fetch failed:", error);
    return new Response("Internal Server Error during API proxy", { status: 500 });
  }
});

function extractPrefixAndRest(pathname, prefixes) {
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null];
}

console.log("🚀 API代理服务器已启动 (Deno)");
console.log("🕒 统计数据每分钟自动刷新页面");
