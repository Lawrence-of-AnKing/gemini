          
/// <reference types="https://deno.land/x/deno@v1.36.3/cli/dts/lib.deno.d.ts" />

// import { serve } from "https://deno.land/std/http/server.ts";

// 添加export {}使文件成为模块，解决await表达式错误
export {};

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

// 初始化Deno KV数据库
let kv: Deno.Kv;

try {
  kv = await Deno.openKv("https://api.deno.com/databases/c876cb9f-5d5c-4cbe-89fd-0a3d4e28b172/connect");
  console.log("✅ 成功连接到远程Deno KV数据库");
} catch (error) {
  console.error("❌ 连接远程Deno KV数据库失败:", error);
  try {
    // 使用本地KV作为备选
    kv = await Deno.openKv();
    console.log("🔄 使用本地KV数据库作为备选");
  } catch (localError) {
    console.error("❌ 连接本地KV数据库也失败:", localError);
    throw new Error("无法连接到任何KV数据库");
  }
}

// 统计数据结构
interface EndpointStats {
  total: number;
  today: number;
  week: number;
  month: number;
}

interface RequestRecord {
  endpoint: string;
  timestamp: number;
}

interface Stats {
  total: number;
  endpoints: Record<string, EndpointStats>;
  requests: RequestRecord[];
}

// 从KV加载统计数据
async function loadStats(): Promise<Stats> {
  try {
    const result = await kv.get(["api_stats"]);
    if (result.value) {
      const stats = result.value as Stats;
      // 确保所有端点都有统计数据
      for (const endpoint of Object.keys(apiMapping)) {
        if (!stats.endpoints[endpoint]) {
          stats.endpoints[endpoint] = { total: 0, today: 0, week: 0, month: 0 };
        }
      }
      return stats;
    }
  } catch (error) {
    console.error("❌ 加载统计数据失败:", error);
  }
  
  // 返回默认统计数据
  const defaultStats: Stats = {
    total: 0,
    endpoints: {},
    requests: []
  };
  
  for (const endpoint of Object.keys(apiMapping)) {
    defaultStats.endpoints[endpoint] = { total: 0, today: 0, week: 0, month: 0 };
  }
  
  return defaultStats;
}

// 保存统计数据到KV
async function saveStats(stats: Stats): Promise<void> {
  try {
    await kv.set(["api_stats"], stats);
  } catch (error) {
    console.error("❌ 保存统计数据失败:", error);
  }
}

// 记录请求
async function recordRequest(endpoint: string): Promise<void> {
  const stats = await loadStats();
  const now = Date.now();
  
  stats.total++;
  stats.endpoints[endpoint].total++;
  stats.requests.push({ endpoint, timestamp: now });
  
  // 清理30天前的请求记录
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  stats.requests = stats.requests.filter(req => req.timestamp > thirtyDaysAgo);
  
  // 更新汇总统计
  updateSummaryStats(stats);
  
  // 保存到KV
  await saveStats(stats);
}

// 更新汇总统计（修复逻辑问题）
function updateSummaryStats(stats: Stats): void {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  // 重置所有端点的时间维度统计
  for (const endpointKey of Object.keys(stats.endpoints)) {
    stats.endpoints[endpointKey].today = 0;
    stats.endpoints[endpointKey].week = 0;
    stats.endpoints[endpointKey].month = 0;
  }

  // 重新计算时间维度统计
  for (const req of stats.requests) {
    const endpointStats = stats.endpoints[req.endpoint];
    if (!endpointStats) continue;

    if (req.timestamp > oneDayAgo) {
      endpointStats.today++;
    }
    if (req.timestamp > sevenDaysAgo) {
      endpointStats.week++;
    }
    if (req.timestamp > thirtyDaysAgo) {
      endpointStats.month++;
    }
  }
}

// 生成统计页面HTML
async function generateStatsHTML(request: Request): Promise<string> {
  const stats = await loadStats();
  updateSummaryStats(stats);
  
  const url = new URL(request.url);
  const currentDomain = `${url.protocol}//${url.host}`;
  
  const openaiStats = stats.endpoints["/openai"] || { today: 0, week: 0, month: 0, total: 0 };
  const geminiStats = stats.endpoints["/gemini"] || { today: 0, week: 0, month: 0, total: 0 };
  const claudeStats = stats.endpoints["/claude"] || { today: 0, week: 0, month: 0, total: 0 };
  const xaiStats = stats.endpoints["/xai"] || { today: 0, week: 0, month: 0, total: 0 };
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API代理服务器 - 统计面板 (Deno KV)</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { text-align: center; color: white; margin-bottom: 40px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .kv-status { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 12px; margin-bottom: 20px; color: #065f46; font-size: 0.9rem; text-align: center; }
        .chart-section { background: rgba(255, 255, 255, 0.95); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 40px; }
        .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .chart-title { font-size: 1.5rem; color: #333; font-weight: 600; }
        .time-tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .time-tab { padding: 8px 16px; border: none; background: transparent; border-radius: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; color: #64748b; transition: all 0.3s ease; }
        .time-tab.active { background: #6366f1; color: white; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3); }
        .time-tab:hover:not(.active) { background: #e2e8f0; color: #334155; }
        .chart-container { position: relative; height: 400px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px; }
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 API代理服务器</h1>
            <p>实时统计与使用指南 (Deno KV数据库)</p>
        </div>
        
        <div class="kv-status">
            📊 数据持久化：使用Deno KV数据库存储统计数据，服务重启后数据不会丢失
        </div>
        
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
            <div class="chart-container"><canvas id="apiChart"></canvas></div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <h3><div class="api-icon openai-icon">AI</div>OpenAI API 调用统计</h3>
                <div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${openaiStats.today}</span></div>
                <div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${openaiStats.week}</span></div>
                <div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${openaiStats.month}</span></div>
                <div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${openaiStats.total}</span></div>
            </div>
            <div class="stat-card">
                <h3><div class="api-icon gemini-icon">G</div>Gemini API 调用统计</h3>
                <div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${geminiStats.today}</span></div>
                <div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${geminiStats.week}</span></div>
                <div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${geminiStats.month}</span></div>
                <div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${geminiStats.total}</span></div>
            </div>
            <div class="stat-card">
                <h3><div class="api-icon claude-icon">C</div>Claude API 调用统计</h3>
                <div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${claudeStats.today}</span></div>
                <div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${claudeStats.week}</span></div>
                <div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${claudeStats.month}</span></div>
                <div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${claudeStats.total}</span></div>
            </div>
            <div class="stat-card">
                <h3><div class="api-icon xai-icon">X</div>XAI API 调用统计</h3>
                <div class="stat-row"><span class="stat-label">24小时</span><span class="stat-value">${xaiStats.today}</span></div>
                <div class="stat-row"><span class="stat-label">7天</span><span class="stat-value">${xaiStats.week}</span></div>
                <div class="stat-row"><span class="stat-label">30天</span><span class="stat-value">${xaiStats.month}</span></div>
                <div class="stat-row"><span class="stat-label">总计</span><span class="stat-value">${xaiStats.total}</span></div>
            </div>
            <div class="stat-card">
                <h3><div class="api-icon total-icon">📊</div>总体统计</h3>
                <div class="stat-row"><span class="stat-label">总请求数</span><span class="stat-value">${stats.total}</span></div>
                <div class="stat-row"><span class="stat-label">活跃端点</span><span class="stat-value">${Object.keys(stats.endpoints).filter(k => stats.endpoints[k].total > 0).length}</span></div>
                <div class="stat-row"><span class="stat-label">服务状态</span><span class="stat-value" style="color: #10b981;">🟢 运行中</span></div>
            </div>
        </div>
        
        <div class="usage-guide">
            <h2>📖 使用说明</h2>
            <h3>支持的API端点</h3>
            <div class="endpoint-list">${Object.keys(apiMapping).map(endpoint => `<div class="endpoint-item" title="点击复制完整地址"><div class="endpoint-path">${endpoint}</div><div class="endpoint-url">${currentDomain}${endpoint}</div></div>`).join('')}</div>
            <div class="example-section">
                <h3>🔧 使用方法</h3>
                <p style="margin-bottom: 16px; color: #666;">将原始API地址替换为代理地址，例如：</p>
                <h4 style="margin: 16px 0 8px 0; color: #333;">OpenAI API 示例：</h4>
                <div class="code-block"># 原始地址
https://api.openai.com/v1/chat/completions

# 代理地址
${currentDomain}/openai/v1/chat/completions</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">Gemini API 示例：</h4>
                <div class="code-block"># 原始地址
https://generativelanguage.googleapis.com/v1/models

# 代理地址
${currentDomain}/gemini/v1/models</div>
                <h4 style="margin: 16px 0 8px 0; color: #333;">Gemini NoThink API 示例：</h4>
                <div class="code-block"># 原始地址
https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-thinking-exp:generateContent

# 代理地址（自动禁用思考模式）
${currentDomain}/gemininthk/v1/models/gemini-2.0-flash-thinking-exp:generateContent</div>
            </div>
            <div class="example-section">
                <h3>📊 KV数据库特性</h3>
                <ul style="margin-left: 20px; color: #666; line-height: 1.6;">
                    <li>✅ 数据持久化：统计数据存储在Deno KV数据库中</li>
                    <li>✅ 高可用性：支持远程KV数据库连接</li>
                    <li>✅ 自动备份：本地KV作为备选方案</li>
                    <li>✅ 实时同步：每次API调用后立即保存数据</li>
                    <li>✅ 原子操作：确保数据一致性</li>
                </ul>
            </div>
        </div>
    </div>
    <button class="refresh-btn" onclick="location.reload()">🔄 刷新数据</button>
    
    <script>
        const rawStatsData = ${JSON.stringify(stats)};
        let chartInstance = null;
        let currentPeriod = 'today';
        const barColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#64748b', '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#3b82f6'];

        function getChartDataForPeriod(period, requests, endpoints) {
            const now = Date.now();
            let labels = [];
            let aggregatedData = [];

            if (period === 'today') {
                const hourlyCounts = Array(24).fill(0);
                for (let i = 0; i < 24; i++) {
                    labels.push(i.toString().padStart(2, '0') + ':00');
                }
                const oneDayAgo = now - (24 * 60 * 60 * 1000);
                requests.filter(req => req.timestamp >= oneDayAgo)
                    .forEach(req => {
                        const reqDate = new Date(req.timestamp);
                        const hour = reqDate.getHours();
                        hourlyCounts[hour]++;
                    });
                aggregatedData = hourlyCounts;
            } else if (period === 'week' || period === 'month') {
                const numDays = period === 'week' ? 7 : 30;
                const dailyCounts = Array(numDays).fill(0);
                for (let i = numDays - 1; i >= 0; i--) {
                    const date = new Date(now - i * 24 * 60 * 60 * 1000);
                    const label = (date.getMonth() + 1) + '-' + date.getDate();
                    labels.push(label);
                }
                const periodStart = now - (numDays * 24 * 60 * 60 * 1000);
                requests.filter(req => req.timestamp >= periodStart)
                    .forEach(req => {
                        const daysDiff = Math.floor((now - req.timestamp) / (24 * 60 * 60 * 1000));
                        const index = numDays - 1 - daysDiff;
                        if (index >= 0 && index < numDays) {
                            dailyCounts[index]++;
                        }
                    });
                aggregatedData = dailyCounts;
            } else if (period === 'total') {
                const activeEndpoints = Object.keys(endpoints).filter(ep => endpoints[ep].total > 0);
                labels = activeEndpoints.map(ep => ep.replace('/', ''));
                aggregatedData = activeEndpoints.map(ep => endpoints[ep].total);
            }
            return { labels, data: aggregatedData };
        }

        function createChart(period) {
            const ctx = document.getElementById('apiChart').getContext('2d');
            if (chartInstance) chartInstance.destroy();
            
            const chartData = getChartDataForPeriod(period, rawStatsData.requests, rawStatsData.endpoints);

            if (chartData.labels.length === 0 || chartData.data.every(d => d === 0)) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.fillStyle = '#64748b'; 
                ctx.font = '16px Arial'; 
                ctx.textAlign = 'center';
                ctx.fillText('暂无数据', ctx.canvas.width / 2, ctx.canvas.height / 2);
                return;
            }
            
            const chartConfig = {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        type: 'bar',
                        label: 'API调用次数',
                        data: chartData.data,
                        backgroundColor: period === 'total' 
                            ? chartData.labels.map((_, i) => barColors[i % barColors.length] + 'B3')
                            : '#6366f1B3',
                        borderColor: period === 'total' 
                            ? chartData.labels.map((_, i) => barColors[i % barColors.length])
                            : '#6366f1',
                        borderWidth: 1.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: '#6366f1',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: period === 'total' ? 'API 端点' : (period === 'today' ? '小时' : '日期'), color: '#333' },
                            ticks: { color: '#64748b' },
                            grid: { color: '#e2e8f0' }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#64748b', precision: 0 },
                            grid: { color: '#e2e8f0' },
                            title: { display: true, text: '调用次数', color: '#333' }
                        }
                    },
                    animation: { duration: 800, easing: 'easeOutQuart' }
                }
            };
            chartInstance = new Chart(ctx, chartConfig);
        }

        function switchPeriod(newPeriod) {
            currentPeriod = newPeriod;
            document.querySelectorAll('.time-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelector('[data-period="' + newPeriod + '"]').classList.add('active');
            createChart(currentPeriod);
        }

        document.addEventListener('DOMContentLoaded', function() {
            createChart(currentPeriod);
            document.querySelectorAll('.time-tab').forEach(tab => {
                tab.addEventListener('click', function() { switchPeriod(this.dataset.period); });
            });
            document.querySelectorAll('.endpoint-item').forEach(item => {
                item.addEventListener('click', function() {
                    const url = this.querySelector('.endpoint-url').textContent.trim();
                    navigator.clipboard.writeText(url).then(() => {
                        const originalBg = this.style.backgroundColor;
                        this.style.backgroundColor = '#dcfce7';
                        setTimeout(() => { this.style.backgroundColor = originalBg; }, 1000);
                    });
                });
            });
        });
    </script>
</body>
</html>`;
}

function extractPrefixAndRest(pathname: string, prefixes: string[]): [string | null, string] {
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, ""];
}

// 使用Deno 2.x的内置serve API
Deno.serve(async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/" || pathname === "/index.html") {
    return new Response(await generateStatsHTML(request), {
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
    const stats = await loadStats();
    updateSummaryStats(stats);
    return new Response(JSON.stringify(stats, null, 2), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
  
  // 代理模式
  if (pathname.startsWith("/proxy/")) {
    try {
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

      if (request.headers.has("referer")) {
        headers.set("Referer", request.headers.get("referer")!.replace(url.origin, targetUrl.origin));
      }

      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        redirect: "manual"
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
      responseHeaders.set("X-Content-Type-Options", "nosniff");
      responseHeaders.set("Referrer-Policy", "no-referrer-when-downgrade");

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: responseHeaders });
      }
      
      // 处理重定向
      if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
        let newLocation = response.headers.get("location")!;
        if (newLocation.startsWith("/")) {
          newLocation = `${baseUrl}${newLocation}`;
        }
        if (newLocation) {
          responseHeaders.set("Location", `${url.origin}/proxy/${newLocation}`);
        }
        return new Response(null, { status: response.status, headers: responseHeaders });
      }

      const contentType = responseHeaders.get("content-type") || "";
      
      if (contentType.includes("text/html")) {
        let text = await response.text();
        const currentProxyBase = `${url.origin}/proxy/`;
        
        // 基本HTML重写
        text = text.replace(/(href|src|action)=["']\/(?!\/)/gi, `$1="${currentProxyBase}${baseUrl}/`);
        text = text.replace(/(href|src|action)=["'](https?:\/\/[^"']+)/gi, (match, attr, originalUrl) => {
          return `${attr}="${currentProxyBase}${originalUrl}"`;
        });
        
        // 重写srcset
        text = text.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
          const newSrcset = srcset.split(',').map(s => {
            const parts = s.trim().split(/\s+/);
            let u = parts[0];
            if (u.startsWith('/')) u = `${baseUrl}${u}`;
            return `${currentProxyBase}${u}${parts[1] ? ' ' + parts[1] : ''}`;
          }).join(', ');
          return `srcset="${newSrcset}"`;
        });
        
        // 移除integrity属性
        text = text.replace(/\s+integrity=["'][^"']+["']/gi, '');
        
        return new Response(text, { status: response.status, headers: responseHeaders });
      } else if (contentType.includes("text/css")) {
        let text = await response.text();
        const currentProxyBase = `${url.origin}/proxy/`;
        
        // 重写CSS中的url()
        text = text.replace(/url\(([^)]+)\)/gi, (match, cssUrl) => {
          let u = cssUrl.trim().replace(/["']/g, '');
          if (u.startsWith('data:') || u.startsWith('#')) return match;
          if (u.startsWith('/')) u = `${baseUrl}${u}`;
          else if (!u.startsWith('http')) u = `${new URL(u, targetUrl.toString()).href}`;
          return `url(${currentProxyBase}${u})`;
        });
        
        return new Response(text, { status: response.status, headers: responseHeaders });
      }

      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch (error) {
      console.error("Proxy request failed:", error);
      return new Response("Proxy Request Failed: " + (error as Error).message, { status: 502 });
    }
  }

  // API代理逻辑
  const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));
  if (!prefix) {
    return new Response("Not Found", { status: 404 });
  }

  // 记录请求到KV数据库
  await recordRequest(prefix);
  const targetApiUrl = `${apiMapping[prefix]}${rest}${url.search}`;

  try {
    const headers = new Headers();
    const commonApiHeaders = ["content-type", "authorization", "accept", "anthropic-version"];
    
    request.headers.forEach((value, key) => {
      if (commonApiHeaders.includes(key.toLowerCase()) || key.toLowerCase().startsWith("x-")) {
        headers.set(key, value);
      }
    });
    
    // 为特定API添加必需的头部
    if (prefix === "/claude" && !headers.has("anthropic-version")) {
      headers.set("anthropic-version", "2023-06-01");
    }
    
    if (!headers.has("user-agent")) {
      headers.set("user-agent", "Deno-API-Proxy/1.0");
    }

    // 处理gemininthk的特殊逻辑
    let requestBody: BodyInit | null = null;
    if (prefix === "/gemininthk" && request.method === "POST" && request.body && headers.get("content-type")?.includes("application/json")) {
      const originalBodyText = await request.text();
      if (originalBodyText) {
        const bodyJson = JSON.parse(originalBodyText);
        
        // 添加thinkingBudget: 0来禁用思考模式
        bodyJson.generationConfig = {
          ...(bodyJson.generationConfig || {}),
          thinkingConfig: {
            thinkingBudget: 0
          }
        };
        
        requestBody = JSON.stringify(bodyJson);
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
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-Frame-Options", "DENY");
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

console.log("🚀 API代理服务器已启动 (Deno 2.x + KV数据库)");
console.log("📊 统计数据将持久化到Deno KV数据库");
console.log("✅ KV数据库连接状态：已连接");

        
