# 多站点广告变现矩阵

通过 5 个**不同形态**的网站对比流量表现，数据驱动决定重点运营哪个，最终通过 Google AdSense 广告变现。

## 为什么不是"一个站做很多功能"

单一站点形态单一，流量获取逻辑固定，错了就全错。多站矩阵的好处：
- **对比验证**：5 种流量获取思路并行测试，2-4 周数据就能看出哪个赛道更适合你
- **风险分散**：某个赛道被搜索引擎算法调整影响，其他站不受牵连
- **复用基础设施**：一套统计、广告、组件系统，边际成本低

## 项目结构

```
make/
├── assets/                  共享资源
│   ├── css/style.css        全站统一样式
│   ├── js/tracker.js        流量统计 SDK（PV/UV/事件/时长）
│   └── js/common.js         公共组件（导航/页脚/广告位/GA/AdSense）
├── dashboard/index.html     统一流量监测面板（4 站对比）
├── tools/                   站点1：实用工具站
│   ├── index.html           工具导航首页
│   ├── unit-converter.html  单位转换器
│   ├── bmi.html             BMI 计算器
│   └── password.html        密码生成器
├── blog/                    站点2：知识内容站
│   ├── index.html           文章列表首页
│   ├── health/bmi-meaning.html
│   ├── life/save-electricity.html
│   └── tech/strong-password.html
├── resources/index.html     站点3：资源聚合站（清单合集）
├── reviews/                 站点4：对比测评站
│   ├── index.html           对比列表
│   └── notion-vs-evernote.html
├── students/                站点5：学生趣味测试站
│   ├── index.html           测试导航首页
│   ├── animal.html          动物性格测试
│   ├── birthday.html        生日密码
│   ├── name-fate.html       名字缘分
│   ├── zodiac.html          星座配对
│   └── student-type.html    你是哪种学生
└── README.md
```

## 五种形态对比

| 站点 | 形态 | 流量获取逻辑 | 关键词示例 |
|------|------|-------------|----------|
| tools | 工具类 | 用户搜具体功能 | "单位转换""BMI 计算" |
| blog | 内容类 | 长尾 SEO 文章 | "BMI 多少正常""空调省电" |
| resources | 资源类 | 推荐汇总型词 | "免费设计工具""开发资源" |
| reviews | 测评类 | "vs""哪个好"词 | "Notion vs 印象笔记" |
| students | 测试类 | 学生社交传播 | "心理测试""星座配对""名字缘分" |

## 学生站特别说明

学生站定位 **小学/初中生群体**，主打心理测试，原因是：
- **传播性强**：学生社交密集，好玩的结果一天就能在班群扩散
- **停留时长长**：做测试 3-5 分钟 + 看结果 + 分享 = 单次会话 6+ 分钟
- **用户粘性高**：测试可重复做、有分享欲、会回来测新测试
- **变现空间大**：停留长 = 广告曝光多

测试清单：
1. 动物性格测试（12 题，8 种动物结果）
2. 生日密码（输入生日算灵数 + 幸运色 + 生日花 + 星座）
3. 名字缘分（输入两人名字算分数，可分享）
4. 星座配对（输入两星座看配对指数）
5. 你是哪种学生（学霸/学渣/潜力股/中庸生/咸鱼生）

学生资源推广建议：
- 在班群、好友群分享某个测试结果（带链接）
- 让学生测完互相分享，引发二次传播
- 周末/放学时间是流量高峰

## 流量监测（核心功能）

访问 `dashboard/index.html` 即可看到统一面板：
- **多站点对比表**：4 个站点的 PV/UV/会话/今日数据横向对比
- **运营洞察**：自动识别流量最高的站点，给出运营建议
- **单站点详情**：切换查看每个站点的趋势图、来源分布、热门页面、用户行为事件、停留时长
- **自动刷新**：每 60 秒刷新，开发期 localStorage 即可查看完整数据

### 数据上报原理
- **本地开发 / 单域部署**：tracker.js 写入 localStorage，dashboard 直接读取，零配置即可看到面板
- **多域部署**：在 tracker.js 中配置 `endpoint` 上报地址，dashboard 调用后端聚合 API
  - 可参考 `tracker.js` 中的 `sendBeacon` 函数实现后端
  - 也可直接通过 iframe + postMessage 跨域拉取（dashboard 已实现）

## 部署步骤

### 1. 本地预览
直接打开 `dashboard/index.html` 即可。建议用静态服务器：
```bash
python -m http.server 8000
# 访问 http://localhost:8000/dashboard/
```

### 2. 配置 Google Analytics 和 AdSense
编辑 [assets/js/common.js](assets/js/common.js) 中 `App.config`：
```js
config: {
  gaId: 'G-XXXXXXXXXX',          // Google Analytics
  adsenseId: 'ca-pub-XXXXXXXXXX' // Google AdSense
}
```
或在每个页面调用时传入：
```js
App.mount({ site: 'tools', gaId: 'G-XXX', adsenseId: 'ca-pub-XXX' });
```

### 3. 部署到静态托管
任选其一：
- **Vercel/Netlify**：连接 Git 仓库自动部署
- **GitHub Pages**：仓库 Settings → Pages → 选分支
- **Cloudflare Pages**：免费 + 全球 CDN
- **国内**：腾讯云 COS / 阿里云 OSS 静态托管（需备案）

建议每个站点用独立子域：`tools.yourdomain.com`、`blog.yourdomain.com`，便于后期独立运营。

### 4. 申请 Google AdSense
- 部署上线后等待 1-2 周让 Google 收录
- 访问 https://www.google.com/adsense 申请
- 通过审核后，在 common.js 配置 `adsenseId` 即自动显示广告

## 运营策略

### 第 1-2 周：基础建设期
- 4 个站点同时上线
- 每个站点至少 3-5 篇核心内容
- 提交到 Google Search Console、百度站长平台
- 申请 AdSense（可能要等审核）

### 第 3-4 周：数据观察期
- 每天打开 dashboard 看数据
- 重点观察：哪个站点的 PV 增长最快？哪个站点的停留时长最长？
- 不要急着优化，让数据说话

### 第 5 周起：重点运营
- **流量最高的站点**：加大投入，每周新增 2-3 篇内容
- **流量第二的站点**：维持更新，每周 1 篇
- **流量差的站点**：暂停更新，但不删除（保留域名权重）

### 持续优化
- 每月分析 dashboard 的热门页面，复制成功模式
- 关注来源分布，找出哪个渠道引流效果好
- 关注事件数据（用户点了哪些工具/链接），优化高价值页面
