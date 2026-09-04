# Single_jiaoben_qinglong

适用于青龙面板的单脚本集合。当前脚本主要改编自 `smallfawn/QLScriptPublic`，已整理成根目录独立任务，并统一使用 `single_` 开头的环境变量。

> 仅用于个人学习、接口测试与自动化研究。第三方接口、签到活动和登录方式可能随服务端调整而失效。

## 当前脚本

| 文件 | 任务 | 默认 cron | 必填环境变量 |
| --- | --- | --- | --- |
| `single_ydyp.js` | 中国移动云盘：签到、日常任务、云朵、活动任务等 | `8 10 * * *` | `single_ydyp_ck` |
| `single_quark.py` | 夸克网盘：每日签到、领取容量 | `0 9 * * *` | `single_quark` |
| `single_wps.js` | WPS：签到、浏览任务、抽奖 | `40 8 * * *` | `single_wps`、`single_wx_server_url`、`single_wx_auth` |
| `single_aliyunpan.py` | 阿里云盘：签到、领奖、容量查询 | `10 6,18 * * *` | `single_aliyun_accounts` |

## 一、青龙拉库

仓库地址：

```text
https://github.com/ZzzHe2333/Single_jiaoben_qinglong.git
```

青龙终端可以使用：

```bash
ql repo https://github.com/ZzzHe2333/Single_jiaoben_qinglong.git "single_" "" "package.json|requirements.txt" "main" "js|py"
```

也可以直接在青龙面板的「订阅管理」中新建订阅：

- 名称：`Single_jiaoben_qinglong`
- 类型：公开仓库
- 仓库地址：`https://github.com/ZzzHe2333/Single_jiaoben_qinglong.git`
- 分支：`main`
- 白名单：`single_`
- 文件后缀：`js|py`
- 依赖文件：`package.json|requirements.txt`

拉取后应出现 4 个主要任务：

```text
single_ydyp.js
single_quark.py
single_wps.js
single_aliyunpan.py
```

## 二、依赖

### Node.js

```text
axios
```

如果青龙没有根据 `package.json` 自动准备依赖，请在「依赖管理 -> NodeJS」安装：

```text
axios
```

### Python3

```text
requests
```

如果缺少，请在「依赖管理 -> Python3」安装：

```text
requests
```

---

# 中国移动云盘

脚本：

```text
single_ydyp.js
```

## 必填变量

```text
single_ydyp_ck
```

推荐账号格式：

```text
Authorization#手机号#authToken
```

也兼容只填：

```text
Authorization
```

多账号使用换行或 `@` 分隔，例如：

```text
Authorization1#13800000000#authToken1
Authorization2#13900000000#authToken2
```

### 参数获取思路

在中国移动云盘 App 登录后抓包，搜索：

```text
authTokenRefresh.do
```

重点查看：

```text
请求头 Authorization
手机号
响应中的 token / authToken
```

如果只配置 `Authorization`，部分依赖笔记 `authToken` 的任务会自动跳过，不影响主要签到流程。

## 可选变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `single_ydyp_upload` | `false` | 是否执行可选大文件上传任务 |
| `single_ydyp_dir_id` | 空 | 上传/分享所需目录 ID |
| `single_ydyp_upload_filename` | `7` | 上传文件名 |
| `single_ydyp_upload_size_mb` | `7` | 上传文件大小 MB |
| `single_ydyp_share` | `false` | 是否执行分享任务 |
| `single_ydyp_share_filename` | 空 | 要查找并分享的文件名 |
| `single_ydyp_push` | `true` | 是否尝试调用青龙通知 |
| `single_ydyp_click_num` | `15` | 点击/摇一摇类任务次数 |
| `single_ydyp_draw_times` | `1` | 自动抽奖次数 |
| `single_ydyp_delay_min` | `1000` | 随机延迟下限，毫秒 |
| `single_ydyp_delay_max` | `1500` | 随机延迟上限，毫秒 |
| `single_ydyp_timeout` | `5000` | 请求超时，毫秒 |

默认情况下不会开启额外大文件上传与分享。

---

# 夸克网盘

脚本：

```text
single_quark.py
```

## 必填变量

```text
single_quark
```

推荐格式：

```text
user=账号备注; url=https://drive-m.quark.cn/1/clouddrive/act/growth/reward?...&kps=xxx&sign=xxx&vcode=xxx;
```

也兼容：

```text
user=账号备注; kps=xxx; sign=xxx; vcode=xxx;
```

多账号使用换行或 `&&` 分隔。

### 参数获取思路

在夸克 App 登录账号后抓包，进入网盘签到/活动页面，查找类似：

```text
https://drive-m.quark.cn/1/clouddrive/act/growth/reward
```

复制包含下列参数的完整 URL：

```text
kps
sign
vcode
```

脚本会自动提取参数，并执行每日网盘容量签到。

---

# WPS

脚本：

```text
single_wps.js
```

WPS 使用微信小程序登录方式，正常长期使用时需要配合 `wx_server` 获取微信小程序登录 `code`。

## 必填变量

```text
single_wps
single_wx_server_url
single_wx_auth
```

### single_wps

最推荐直接填账号对应的 `openid`：

```text
single_wps=你的openid
```

多账号使用换行或 `&` 分隔。

脚本也兼容：

```text
openid#cookie
```

或：

```text
openid|cookie
```

以及 JSON：

```json
{"openid":"你的openid","cookie":"","secret":""}
```

### wx_server

```text
single_wx_server_url=http://你的wx_server地址:端口
single_wx_auth=你的wx_server鉴权值
```

脚本会访问：

```text
POST /wx/code
```

获取 WPS 微信小程序登录所需的 `code`，再自动维护 WPS 登录态。

> 本仓库只包含 WPS 青龙任务，不包含 `wx_server` 服务端本身。

## 可选变量

```text
single_wps_lottery_limit
```

默认：

```text
5
```

用于限制单次任务最多尝试多少次抽奖。

执行内容主要包括：

```text
自动登录
查询签到状态
每日签到
完成浏览任务
查询抽奖次数
自动尝试抽奖
```

---

# 阿里云盘

脚本：

```text
single_aliyunpan.py
```

## 必填变量

```text
single_aliyun_accounts
```

格式：

```text
refresh_token#备注名
```

多账号可使用 `&` 或换行分隔，例如：

```text
refresh_token_1#账号1&refresh_token_2#账号2
```

### refresh_token 获取方法

登录阿里云盘网页端后，打开浏览器开发者工具，在控制台执行：

```javascript
JSON.parse(localStorage.getItem("token")).refresh_token
```

将返回值填入 `single_aliyun_accounts`。

脚本主要执行：

```text
refresh_token 换取 access_token
每日签到
领取当天奖励
查询本月签到天数
查询网盘总容量和已用容量
```

---

# 青龙环境变量汇总

| 环境变量 | 对应脚本 | 必填 |
| --- | --- | --- |
| `single_ydyp_ck` | 中国移动云盘 | 是 |
| `single_ydyp_*` | 中国移动云盘高级设置 | 否 |
| `single_quark` | 夸克 | 是 |
| `single_wps` | WPS | 是 |
| `single_wx_server_url` | WPS | 是，openid 自动登录需要 |
| `single_wx_auth` | WPS | 是，openid 自动登录需要 |
| `single_wps_lottery_limit` | WPS | 否 |
| `single_aliyun_accounts` | 阿里云盘 | 是 |

本仓库脚本不再以原来的 `ydyp_ck`、`COOKIE_QUARK`、`wps`、`ALIYUN_ACCOUNTS` 作为主要配置变量，统一改为 `single_` 前缀。

## 手动运行

青龙脚本目录中可分别测试：

```bash
node single_ydyp.js
python3 single_quark.py
node single_wps.js
python3 single_aliyunpan.py
```

如果出现 `Cannot find module 'axios'` 或 `No module named 'requests'`，先按上面的依赖章节安装对应依赖。

## 来源

主要参考与改编：

```text
https://github.com/smallfawn/QLScriptPublic
```

对应上游文件：

```text
daily/ydyp.js
daily/quark.py
wxapp/wps.js
daily/aliyunpan.py
```
