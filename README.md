# Single_jiaoben_qinglong

青龙面板单入口聚合脚本。青龙只需要执行一个文件：

```bash
node single.js
```

`single.js` 会自动读取 `single_` 开头的环境变量，检测到哪个账号变量就执行哪个模块；同时配置多个账号变量时，会一次依次执行全部已配置模块。

> 主要参考及改编自 `smallfawn/QLScriptPublic`。仅用于个人学习、接口测试与自动化研究，第三方接口和活动规则可能随服务端调整而变化。

## 支持的任务

| 模块 | 检测环境变量 | 说明 |
| --- | --- | --- |
| 中国移动云盘 | `single_ydyp_ck` | 签到、日常任务、云朵、活动等 |
| 夸克网盘 | `single_quark` | 每日签到、领取容量 |
| WPS | `single_wps` | 签到、浏览任务、抽奖 |
| 阿里云盘 | `single_aliyun_accounts` | 签到、领奖、容量查询 |

例如只配置：

```text
single_quark
```

那么运行 `single.js` 时只会执行夸克。

如果同时配置：

```text
single_ydyp_ck
single_quark
single_wps
single_aliyun_accounts
```

则一次运行会依次执行：

```text
中国移动云盘
夸克网盘
WPS
阿里云盘
```

未配置的模块自动跳过。

---

# 一、青龙拉库

仓库：

```text
https://github.com/ZzzHe2333/Single_jiaoben_qinglong.git
```

青龙终端：

```bash
ql repo https://github.com/ZzzHe2333/Single_jiaoben_qinglong.git "single.js" "" "package.json" "main" "js"
```

也可以在「订阅管理」中新建：

```text
名称：Single_jiaoben_qinglong
仓库：https://github.com/ZzzHe2333/Single_jiaoben_qinglong.git
分支：main
白名单：single.js
依赖文件：package.json
文件后缀：js
```

拉取后青龙只需要有一个任务：

```text
Single-聚合签到
```

执行命令：

```bash
node single.js
```

默认 cron：

```text
15 9 * * *
```

如果之前拉取过旧版本，请把旧任务：

```text
single_ydyp.js
single_quark.py
single_wps.js
single_aliyunpan.py
```

从青龙定时任务中删除，之后只保留 `single.js`。

---

# 二、依赖

现在统一使用 Node.js，不再需要 Python 依赖。

NodeJS 依赖只有：

```text
axios
```

如果青龙没有根据 `package.json` 自动安装，在：

```text
依赖管理 -> NodeJS
```

添加：

```text
axios
```

---

# 三、中国移动云盘

检测变量：

```text
single_ydyp_ck
```

推荐格式：

```text
Authorization#手机号#authToken
```

也兼容只填：

```text
Authorization
```

多账号使用换行或 `@` 分隔：

```text
Authorization1#13800000000#authToken1
Authorization2#13900000000#authToken2
```

## 可选变量

| 环境变量 | 默认值 | 说明 |
| --- | ---: | --- |
| `single_ydyp_upload` | `false` | 是否执行可选大文件上传 |
| `single_ydyp_dir_id` | 空 | 上传/分享目录 ID |
| `single_ydyp_upload_filename` | `7` | 上传文件名 |
| `single_ydyp_upload_size_mb` | `7` | 上传文件大小 MB |
| `single_ydyp_share` | `false` | 是否执行分享任务 |
| `single_ydyp_share_filename` | 空 | 分享文件名 |
| `single_ydyp_push` | `true` | 青龙通知 |
| `single_ydyp_click_num` | `15` | 点击/摇一摇次数 |
| `single_ydyp_draw_times` | `1` | 抽奖次数 |
| `single_ydyp_delay_min` | `1000` | 随机延迟下限，ms |
| `single_ydyp_delay_max` | `1500` | 随机延迟上限，ms |
| `single_ydyp_timeout` | `5000` | 请求超时，ms |

抓包时可搜索：

```text
authTokenRefresh.do
```

重点获取请求头 `Authorization`、手机号以及响应中的 token/authToken。

---

# 四、夸克网盘

检测变量：

```text
single_quark
```

推荐格式：

```text
user=账号备注; url=https://drive-m.quark.cn/1/clouddrive/act/growth/reward?...&kps=xxx&sign=xxx&vcode=xxx;
```

也支持：

```text
user=账号备注; kps=xxx; sign=xxx; vcode=xxx;
```

多账号使用换行或 `&&`：

```text
user=账号1; kps=xxx; sign=xxx; vcode=xxx;
&&
user=账号2; kps=xxx; sign=xxx; vcode=xxx;
```

抓包时进入夸克网盘签到/活动页面，查找包含：

```text
kps
sign
vcode
```

的请求 URL。

---

# 五、WPS

检测变量：

```text
single_wps
```

推荐直接填写微信账号对应的 `openid`：

```text
single_wps=openid
```

多账号使用换行或 `&` 分隔。

也兼容：

```text
openid#cookie
```

```text
openid|cookie
```

或：

```json
{"openid":"你的openid","cookie":"","secret":""}
```

使用 `openid` 自动登录时还需要：

```text
single_wx_server_url=http://你的wx_server地址:端口
single_wx_auth=你的wx_server鉴权
```

脚本会调用：

```text
POST /wx/code
```

获取微信小程序登录 code，并自动维护 WPS 登录态。

可选：

```text
single_wps_lottery_limit=5
```

用于限制单次最多抽奖次数。

> 仓库内不包含 wx_server 服务端，需要自行已有可用的 wx_server。

---

# 六、阿里云盘

检测变量：

```text
single_aliyun_accounts
```

格式：

```text
refresh_token#备注名
```

多账号使用 `&` 或换行：

```text
refresh_token_1#账号1&refresh_token_2#账号2
```

网页端登录阿里云盘后，可在浏览器开发者工具控制台获取 refresh_token：

```javascript
JSON.parse(localStorage.getItem("token")).refresh_token
```

任务会执行：

```text
refresh_token 换取 access_token
每日签到
领取当天奖励
查询本月签到天数
查询总容量和已用容量
```

---

# 七、环境变量总表

| 环境变量 | 用途 |
| --- | --- |
| `single_ydyp_ck` | 开启中国移动云盘模块 |
| `single_ydyp_*` | 中国移动云盘可选配置 |
| `single_quark` | 开启夸克模块 |
| `single_wps` | 开启 WPS 模块 |
| `single_wx_server_url` | WPS 微信登录服务地址 |
| `single_wx_auth` | WPS 微信登录服务鉴权 |
| `single_wps_lottery_limit` | WPS 最大抽奖次数 |
| `single_aliyun_accounts` | 开启阿里云盘模块 |

只要至少存在一个主变量即可运行。

如果四个主变量都没有设置，`single.js` 会直接提示：

```text
未检测到任何可执行环境变量
```

---

# 八、手动测试

进入仓库目录后只需要：

```bash
node single.js
```

不需要分别运行任何其他脚本。

仓库中的：

```text
lib/ydyp.inc
lib/wps.inc
```

属于 `single.js` 内部实现文件，不是青龙任务，不需要手动运行，也不要在青龙中单独创建定时任务。

---

# 来源

主要参考：

```text
https://github.com/smallfawn/QLScriptPublic
```

对应上游功能来源包括：

```text
daily/ydyp.js
daily/quark.py
wxapp/wps.js
daily/aliyunpan.py
```
