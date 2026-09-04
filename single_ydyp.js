/*
new Env('Single-中国移动云盘');
cron: 8 10 * * *

来源改编：smallfawn/QLScriptPublic daily/ydyp.js
青龙环境变量全部使用 single_ 前缀。

必填：single_ydyp_ck
多账号：换行或 @ 分隔。
账号值支持：
  Authorization
  Authorization#手机号#authToken

可选：
  single_ydyp_upload=false
  single_ydyp_dir_id=
  single_ydyp_upload_filename=7
  single_ydyp_upload_size_mb=7
  single_ydyp_share=false
  single_ydyp_share_filename=
  single_ydyp_push=true
  single_ydyp_click_num=15
  single_ydyp_draw_times=1
  single_ydyp_delay_min=1000
  single_ydyp_delay_max=1500
  single_ydyp_timeout=5000
*/

const axios = require("axios");
const crypto = require("crypto");

const TITLE = "中国移动云盘";
const ENV_NAME = "single_ydyp_ck";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 11; M2012K10C Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.210 Mobile Safari/537.36 MCloudApp/10.0.1";

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function maskAccount(value = "") {
  const text = String(value || "未知账号");
  return text.length >= 7 ? `${text.slice(0, 3)}****${text.slice(7)}` : text;
}
function basic(value = "") {
  const text = String(value || "");
  return /^Basic\s+/i.test(text) ? text : `Basic ${text}`;
}
function formatDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
}

const config = {
  uploadEnabled: bool(process.env.single_ydyp_upload, false),
  uploadDirId: String(process.env.single_ydyp_dir_id || ""),
  uploadFilename: String(process.env.single_ydyp_upload_filename || "7"),
  uploadSizeMb: num(process.env.single_ydyp_upload_size_mb, 7),
  shareEnabled: bool(process.env.single_ydyp_share, false),
  shareFilename: String(process.env.single_ydyp_share_filename || ""),
  push: bool(process.env.single_ydyp_push, true),
  clickNum: num(process.env.single_ydyp_click_num, 15),
  drawTimes: num(process.env.single_ydyp_draw_times, 1),
  delayMin: num(process.env.single_ydyp_delay_min, 1000),
  delayMax: num(process.env.single_ydyp_delay_max, 1500),
  timeout: num(process.env.single_ydyp_timeout, 5000),
};

const logs = [];
const errors = [];
const amounts = [];
const invalid = [];
function log(text = "") {
  text = String(text);
  logs.push(text);
  console.log(text);
}
function accountLog(account, text) { log(`[${maskAccount(account)}] ${text}`); }

class MobileCloudAccount {
  constructor(raw, index) {
    this.index = index;
    this.raw = String(raw || "").trim();
    this.cookies = {};
    this.jwtToken = "";
    this.parseAccount();
  }

  parseAccount() {
    if (this.raw.includes("#")) {
      const [authorization, account, authToken] = this.raw.split("#");
      this.authorization = String(authorization || "").trim();
      this.account = String(account || "").trim();
      this.authToken = String(authToken || "").trim();
    } else {
      this.authorization = this.raw;
      this.authToken = "00";
      this.account = this.decodeAccount(this.authorization);
    }
    if (!this.account) this.account = `账号${this.index}`;
  }

  decodeAccount(value) {
    try {
      const token = String(value || "").replace(/^Basic\s+/i, "");
      const decoded = Buffer.from(token, "base64").toString("utf8");
      return decoded.split(":")[1] || "";
    } catch { return ""; }
  }

  cookieHeader() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorbCookies(setCookie) {
    if (!setCookie) return;
    for (const item of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const first = String(item).split(";")[0];
      const pos = first.indexOf("=");
      if (pos > 0) this.cookies[first.slice(0, pos).trim()] = first.slice(pos + 1).trim();
    }
  }

  async request(options, retries = 3) {
    let last;
    for (let i = 0; i < retries; i++) {
      try {
        const headers = { ...(options.headers || {}) };
        if (!headers.Cookie && this.cookieHeader()) headers.Cookie = this.cookieHeader();
        const res = await axios({
          method: options.method || "GET",
          url: options.url,
          headers,
          data: options.data,
          params: options.params,
          timeout: options.timeout || config.timeout,
          responseType: options.responseType || "json",
          validateStatus: () => true,
          maxRedirects: 5,
        });
        this.absorbCookies(res.headers?.["set-cookie"]);
        if (res.status >= 400 && options.throwHttpErrors !== false) {
          throw new Error(`HTTP ${res.status}: ${typeof res.data === "string" ? res.data.slice(0, 200) : JSON.stringify(res.data)}`);
        }
        return res;
      } catch (e) {
        last = e;
        if (i < retries - 1) await sleep(1000);
      }
    }
    throw last;
  }

  async json(options, retries = 3) {
    const res = await this.request({ ...options, responseType: "json" }, retries);
    if (typeof res.data === "string") {
      try { return JSON.parse(res.data); } catch { return { msg: res.data, status: res.status }; }
    }
    return res.data;
  }

  jwtHeaders(extra = {}) {
    return {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
      Host: "caiyun.feixin.10086.cn:7071",
      ...(this.jwtToken ? { jwtToken: this.jwtToken } : {}),
      ...extra,
    };
  }

  async delay() { await sleep(randomInt(config.delayMin, config.delayMax)); }

  async getSsoToken() {
    try {
      const data = await this.json({
        method: "POST",
        url: "https://orches.yun.139.com/orchestration/auth-rebuild/token/v1.0/querySpecToken",
        headers: {
          Authorization: this.authorization,
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json",
          Accept: "*/*",
          Host: "orches.yun.139.com",
        },
        data: { account: this.account, toSourceId: "001005" },
      });
      if (data?.success && data?.data?.token) return data.data.token;
    } catch (e) {
      accountLog(this.account, `MCloud SSO 获取失败: ${e.message}`);
    }

    try {
      const data = await this.json({
        method: "POST",
        url: "https://user-njs.yun.139.com/user/querySpecToken",
        headers: {
          Authorization: basic(this.authorization),
          "Content-Type": "application/json",
          Accept: "*/*",
          Host: "user-njs.yun.139.com",
          "User-Agent": USER_AGENT,
        },
        data: { phoneNumber: this.account, toSourceId: "001003" },
      });
      if (data?.success && data?.data?.token) return data.data.token;
    } catch (e) {
      accountLog(this.account, `Portal SSO 获取失败: ${e.message}`);
    }
    return null;
  }

  async jwt() {
    const sso = await this.getSsoToken();
    if (!sso) {
      accountLog(this.account, "获取 ssoToken 失败");
      return false;
    }
    const data = await this.json({
      method: "POST",
      url: `https://caiyun.feixin.10086.cn:7071/portal/auth/tyrzLogin.action?ssoToken=${encodeURIComponent(sso)}`,
      headers: this.jwtHeaders(),
    });
    if (data && Number(data.code) === 0 && data?.result?.token) {
      this.jwtToken = data.result.token;
      this.cookies.jwtToken = this.jwtToken;
      accountLog(this.account, "jwtToken 获取成功");
      return true;
    }
    accountLog(this.account, `获取 jwtToken 失败: ${data?.msg || "未知错误"}`);
    return false;
  }

  async signin() {
    await this.delay();
    const status = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/signin/page/info?client=app",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    if (status?.msg === "success" && status?.result?.todaySignIn) {
      accountLog(this.account, "今日已签到");
      return;
    }
    if (status?.msg !== "success") {
      accountLog(this.account, "签到状态查询接口不可用，直接尝试签到");
    }
    const result = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/manager/commonMarketconfig/getByMarketRuleName?marketName=sign_in_3",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    accountLog(this.account, result?.msg === "success" ? "签到完成" : `签到结果: ${result?.msg || JSON.stringify(result)}`);
  }

  async clickTask(id, options = {}) {
    return this.json({
      method: "GET",
      url: `https://caiyun.feixin.10086.cn/market/signin/task/click?key=task&id=${id}`,
      headers: this.jwtHeaders(),
      throwHttpErrors: options.throwHttpErrors !== false,
    });
  }

  async clickDaily() {
    let success = 0;
    for (let i = 0; i < config.clickNum; i++) {
      try {
        const data = await this.clickTask(319, { throwHttpErrors: false });
        if (data?.result) success++;
      } catch {}
      await sleep(200);
    }
    accountLog(this.account, success ? `戳一下成功 ${success} 次` : `戳一下未获得奖励 x ${config.clickNum}`);
  }

  skipTask(app, cycle, id) {
    if (app === "cloud_app" && cycle === "month") return [110, 113, 417, 409].includes(Number(id));
    if (app === "cloud_app" && cycle === "day") return Number(id) === 404;
    return app === "email_app" && cycle === "month" && [1004, 1005, 1015, 1020].includes(Number(id));
  }

  async getTaskList(market) {
    return this.json({
      method: "GET",
      url: `https://caiyun.feixin.10086.cn/market/signin/task/taskList?marketname=${market}`,
      headers: this.jwtHeaders(),
    });
  }

  async processTaskList(market, app) {
    let data;
    try { data = await this.getTaskList(market); }
    catch (e) { accountLog(this.account, `获取任务列表失败: ${e.message}`); return; }
    await this.delay();
    const groups = data?.result || {};
    for (const cycle of Object.keys(groups)) {
      if (["new", "hidden", "hiddenabc"].includes(cycle)) continue;
      const tasks = Array.isArray(groups[cycle]) ? groups[cycle] : [];
      for (const task of tasks) {
        if (this.skipTask(app, cycle, task.id)) continue;
        if (task.state === "FINISH") {
          accountLog(this.account, `已完成任务: ${task.name}`);
          continue;
        }
        accountLog(this.account, `去完成任务: ${task.name}`);
        try {
          await this.delay();
          await this.clickTask(task.id, { throwHttpErrors: false });
          if (app === "cloud_app" && cycle === "day" && Number(task.id) === 106) await this.uploadZeroFile();
          if (app === "cloud_app" && cycle === "day" && Number(task.id) === 107) await this.createDefaultNote();
        } catch (e) {
          accountLog(this.account, `任务 ${task.name || task.id} 异常: ${e.message}`);
        }
        await sleep(2000);
      }
    }
  }

  async uploadZeroFile() {
    const xml = [
      "<pcUploadFileRequest>", `<ownerMSISDN>${this.account}</ownerMSISDN>`, "<fileCount>1</fileCount>",
      "<totalSize>1</totalSize>", '<uploadContentList length="1">', "<uploadContentInfo>",
      "<comlexFlag>0</comlexFlag>", "<contentDesc><![CDATA[]]></contentDesc>",
      "<contentName><![CDATA[000000.txt]]></contentName>", "<contentSize>1</contentSize>",
      "<contentTAGList></contentTAGList>", "<digest>C4CA4238A0B923820DCC509A6F75849B</digest>",
      "<exif/>", "<fileEtag>0</fileEtag>", "<fileVersion>0</fileVersion>", "<updateContentID></updateContentID>",
      "</uploadContentInfo>", "</uploadContentList>", "<newCatalogName></newCatalogName>",
      "<parentCatalogID></parentCatalogID>", "<operation>0</operation>", "<path></path>",
      "<manualRename>2</manualRename>", '<autoCreatePath length="0"/>', "<tagID></tagID>",
      "<tagType></tagType>", "</pcUploadFileRequest>",
    ].join("");
    await this.request({
      method: "POST",
      url: "http://ose.caiyun.feixin.10086.cn/richlifeApp/devapp/IUploadAndDownload",
      headers: {
        "x-huawei-uploadSrc": "1", "x-ClientOprType": "11", Connection: "keep-alive",
        "x-NetType": "6", "x-huawei-channelSrc": "10000023", "x-MM-Source": "032", "x-SvcType": "1",
        APP_NUMBER: this.account, Authorization: this.authorization, Host: "ose.caiyun.feixin.10086.cn",
        "User-Agent": "okhttp/3.11.0", "Content-Type": "application/xml; charset=UTF-8", Accept: "*/*",
      },
      data: xml,
      responseType: "text",
      throwHttpErrors: false,
    });
    accountLog(this.account, "上传任务文件完成");
  }

  async refreshNoteToken() {
    if (!this.authToken || this.authToken === "00") return null;
    const res = await this.request({
      method: "POST",
      url: "http://mnote.caiyun.feixin.10086.cn/noteServer/api/authTokenRefresh.do",
      headers: {
        "X-Tingyun-Id": "p35OnrDoP8k;c=2;r=1122634489;u=43ee994e8c3a6057970124db00b2442c::8B3D3F05462B6E4C",
        Charset: "UTF-8", Connection: "Keep-Alive", "User-Agent": "mobile", APP_CP: "android",
        CP_VERSION: "3.2.0", "x-huawei-channelsrc": "10001400", Host: "mnote.caiyun.feixin.10086.cn",
        "Content-Type": "application/json; charset=UTF-8", Accept: "*/*",
      },
      data: { authToken: this.authToken, userPhone: this.account },
      throwHttpErrors: false,
    });
    const noteToken = res.headers?.note_token || res.headers?.NOTE_TOKEN;
    const appAuth = res.headers?.app_auth || res.headers?.APP_AUTH;
    return noteToken && appAuth ? { noteToken, appAuth } : null;
  }

  async createDefaultNote() {
    const token = await this.refreshNoteToken();
    if (!token) { accountLog(this.account, "跳过创建笔记: 缺少/失效 authToken"); return; }
    const headers = {
      "User-Agent": "mobile", APP_NUMBER: this.account, APP_AUTH: token.appAuth, NOTE_TOKEN: token.noteToken,
      "Content-Type": "application/json; charset=UTF-8", Accept: "*/*",
    };
    const notebooks = await this.json({
      method: "POST",
      url: "http://mnote.caiyun.feixin.10086.cn/noteServer/api/syncNotebookV3.do",
      headers,
      data: { addNotebooks: [], delNotebooks: [], notebookRefs: [], updateNotebooks: [] },
    });
    const notebookId = notebooks?.notebooks?.[0]?.notebookId;
    if (!notebookId) { accountLog(this.account, "获取默认笔记本失败"); return; }
    const noteId = crypto.randomBytes(16).toString("hex");
    const now = String(Date.now());
    await this.request({
      method: "POST",
      url: "http://mnote.caiyun.feixin.10086.cn/noteServer/api/createNote.do",
      headers,
      data: {
        archived: 0, attachmentdir: noteId, attachmentdirid: "", attachments: [],
        audioInfo: { audioDuration: 0, audioSize: 0, audioStatus: 0 }, contentid: "",
        contents: [{ contentid: 0, data: '<font size="3">000000</font>', noteId, sortOrder: 0, type: "RICHTEXT" }],
        cp: "", createtime: now, description: "android", expands: { noteType: 0 }, latlng: "", location: "",
        noteid: noteId, notestatus: 0, remindtime: "", remindtype: 1, revision: "1", sharecount: "0",
        sharestatus: "0", system: "mobile", tags: [{ id: notebookId, orderIndex: "0", text: "默认笔记本" }],
        title: "00000", topmost: "0", updatetime: now, userphone: this.account, version: "1.00", visitTime: "",
      },
      throwHttpErrors: false,
    });
    accountLog(this.account, "创建笔记完成");
  }

  async cloudGame() {
    const info = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/signin/hecheng1T/info?op=info",
      headers: this.jwtHeaders(),
    });
    const count = Number(info?.result?.info?.curr || 0);
    const rank = info?.result?.history?.[0]?.rank || "";
    const merged = info?.result?.history?.[0]?.count || 0;
    accountLog(this.account, `云朵大作战剩余 ${count} 次, 排名 ${rank}, 合成 ${merged} 次`);
    for (let i = 0; i < count; i++) {
      await this.json({ method: "GET", url: "https://caiyun.feixin.10086.cn/market/signin/hecheng1T/beinvite", headers: this.jwtHeaders() });
      await sleep(randomInt(10000, 15000));
      await this.json({ method: "GET", url: "https://caiyun.feixin.10086.cn/market/signin/hecheng1T/finish?flag=true", headers: this.jwtHeaders() });
      accountLog(this.account, "云朵大作战完成一局");
    }
  }

  async wxSign() {
    await this.delay();
    const data = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/playoffic/followSignInfo?isWx=true",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    accountLog(this.account, data?.result?.todaySignIn ? "公众号签到成功" : `公众号签到结果: ${data?.msg || "可能未绑定公众号"}`);
  }

  async shake() {
    let win = 0;
    for (let i = 0; i < config.clickNum; i++) {
      try {
        const data = await this.json({
          method: "POST",
          url: "https://caiyun.feixin.10086.cn:7071/market/shake-server/shake/shakeIt?flag=1",
          headers: this.jwtHeaders(),
          throwHttpErrors: false,
        });
        const prize = data?.result?.shakePrizeconfig?.name;
        if (prize) { win++; accountLog(this.account, `摇一摇获得: ${prize}`); }
      } catch {}
      await sleep(1000);
    }
    if (!win) accountLog(this.account, `摇一摇未中奖 x ${config.clickNum}`);
  }

  async draw() {
    await this.delay();
    const data = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/playoffic/drawInfo",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    const surplus = Number(data?.result?.surplusNumber || 0);
    accountLog(this.account, `剩余抽奖次数: ${surplus}`);
    if (surplus <= 50 - config.drawTimes) return;
    for (let i = 0; i < config.drawTimes; i++) {
      await this.delay();
      const result = await this.json({
        method: "GET",
        url: "https://caiyun.feixin.10086.cn/market/playoffic/draw",
        headers: this.jwtHeaders(),
        throwHttpErrors: false,
      });
      accountLog(this.account, Number(result?.code) === 0 ? `抽奖成功: ${result?.result?.prizeName || ""}` : `抽奖失败: ${result?.msg || "未知"}`);
    }
  }

  async backupCloud() {
    const info = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/backupgift/info",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    const state = info?.result?.state;
    if (Number(state) === 0) {
      const res = await this.json({ method: "GET", url: "https://caiyun.feixin.10086.cn/market/backupgift/receive", headers: this.jwtHeaders(), throwHttpErrors: false });
      accountLog(this.account, `连续备份奖励: ${res?.result?.result || res?.msg || ""}`);
    } else if (Number(state) === 1) accountLog(this.account, "本月连续备份奖励已领取");

    await this.delay();
    const expand = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/signin/page/taskExpansion",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    if (expand?.result?.preMonthBackup && !expand?.result?.curMonthBackupTaskAccept) {
      const acceptDate = expand.result.acceptDate;
      const res = await this.json({
        method: "GET",
        url: `https://caiyun.feixin.10086.cn/market/signin/page/receiveTaskExpansion?acceptDate=${encodeURIComponent(acceptDate)}`,
        headers: this.jwtHeaders(),
        throwHttpErrors: false,
      });
      accountLog(this.account, `膨胀云朵领取: ${res?.result?.cloudCount || res?.msg || ""}`);
    }
  }

  async messagePush() {
    const status = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/msgPushOn/task/status",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    if (Number(status?.result?.pushOn) !== 1) { accountLog(this.account, "通知权限未开启"); return; }
    for (const type of [1, 2]) {
      const key = type === 1 ? "firstTaskStatus" : "secondTaskStatus";
      if (![2, 3].includes(Number(status.result[key]))) continue;
      const data = await this.json({
        method: "POST",
        url: "https://caiyun.feixin.10086.cn/market/msgPushOn/task/obtain",
        headers: this.jwtHeaders({ "Content-Type": "application/json" }),
        data: { type },
        throwHttpErrors: false,
      });
      accountLog(this.account, `通知奖励${type}: ${data?.result?.description || data?.msg || "已处理"}`);
    }
  }

  async receiveClouds() {
    const receive = await this.json({
      method: "GET",
      url: "https://caiyun.feixin.10086.cn/market/signin/page/receive",
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    await this.delay();
    const history = await this.json({
      method: "GET",
      url: `https://caiyun.feixin.10086.cn/market/prizeApi/checkPrize/getUserPrizeLogPage?currPage=1&pageSize=15&_=${Date.now()}`,
      headers: this.jwtHeaders(),
      throwHttpErrors: false,
    });
    const prizes = (history?.result?.result || []).filter((x) => Number(x.flag) === 1).map((x) => x.prizeName).join("、");
    const got = receive?.result?.receive || 0;
    const total = receive?.result?.total || 0;
    amounts.push(`${maskAccount(this.account)}: 云朵 ${total}${prizes ? `，待领取 ${prizes}` : ""}`);
    accountLog(this.account, `当前待领取 ${got} 云朵, 当前总数 ${total}`);
  }

  async uploadLargeFile() {
    if (!config.uploadDirId) { accountLog(this.account, "跳过大文件上传: 缺少 single_ydyp_dir_id"); return; }
    const size = Math.max(1, Math.floor(config.uploadSizeMb * 1024 * 1024));
    const content = crypto.randomBytes(size);
    const digest = crypto.createHash("md5").update(content).digest("hex").toUpperCase();
    const xml = [
      "<pcUploadFileRequest>", `<ownerMSISDN>${this.account}</ownerMSISDN>`, "<fileCount>1</fileCount>",
      `<totalSize>${size}</totalSize>`, '<uploadContentList length="1">', "<uploadContentInfo>",
      `<contentName><![CDATA[${config.uploadFilename}]]></contentName>`, `<contentSize>${size}</contentSize>`,
      "<contentDesc></contentDesc>", "<contentTAGList></contentTAGList>", "<comlexFlag>0</comlexFlag>",
      "<comlexCID></comlexCID>", '<resCID length="0"></resCID>', `<digest>${digest}</digest>`,
      `<extInfo length="1"><entry><key>modifyTime</key><vaule>${formatDate()}</vaule></entry></extInfo>`,
      "</uploadContentInfo>", "</uploadContentList>", "<newCatalogName></newCatalogName>",
      `<parentCatalogID>${config.uploadDirId}</parentCatalogID>`, "<operation>0</operation>", "<path></path>",
      "<manualRename>2</manualRename>", "</pcUploadFileRequest>",
    ].join("");
    await this.request({
      method: "POST",
      url: "https://ose.caiyun.feixin.10086.cn/richlifeApp/devapp/IUploadAndDownload",
      headers: {
        "x-huawei-uploadSrc": "1", "x-huawei-channelSrc": "10200153", "x-ClientOprType": "11",
        Connection: "keep-alive", "x-NetType": "6", "x-MM-Source": "032", "x-SvcType": "1",
        Authorization: basic(this.authorization), Host: "ose.caiyun.feixin.10086.cn",
        "User-Agent": "Mozilla/5.0", "Content-Type": "text/xml;UTF-8", Accept: "*/*",
      },
      data: xml,
      responseType: "text",
      throwHttpErrors: false,
    });
    accountLog(this.account, `大文件上传任务已执行: ${config.uploadFilename}`);
  }

  async shareFile() {
    if (!config.shareFilename || !config.uploadDirId) {
      accountLog(this.account, "跳过分享任务: 缺少 single_ydyp_share_filename 或 single_ydyp_dir_id");
      return;
    }
    const list = await this.json({
      method: "POST",
      url: "https://personal-kd-njs.yun.139.com/hcy/file/list",
      headers: {
        "x-yun-op-type": "1", "x-yun-net-type": "1", "x-yun-module-type": "100", "x-yun-app-channel": "10214200",
        authorization: basic(this.authorization), "x-yun-api-version": "v1", xweb_xhr: "1", "content-type": "application/json",
      },
      data: {
        parentFileId: config.uploadDirId,
        pageInfo: { pageSize: 40, pageCursor: "0" },
        imageThumbnailStyleList: ["Big", "Small"], orderDirection: "DESC", orderBy: "updated_at",
      },
    });
    const items = list?.data?.items || list?.items || [];
    const file = items.find((x) => String(x.name || "").includes(config.shareFilename));
    if (!file) { accountLog(this.account, "未找到可分享文件"); return; }
    const data = await this.json({
      method: "POST",
      url: "https://yun.139.com/orchestration/personalCloud-rebuild/outlink/v1.0/getOutLink",
      headers: { ...this.jwtHeaders(), Authorization: basic(this.authorization), "Content-Type": "application/json" },
      data: {
        getOutLinkReq: {
          subLinkType: 0, encrypt: 1, coIDLst: [file.fileId], caIDLst: [], pubType: 1,
          dedicatedName: file.name, periodUnit: 1, viewerLst: [], extInfo: { isWatermark: 0, shareChannel: "3001" },
          period: 1, commonAccountInfo: { account: this.account, accountType: 1 },
        },
      },
    });
    const link = data?.data?.getOutLinkRes?.getOutLinkResSet?.[0]?.linkUrl || "";
    accountLog(this.account, link ? `分享成功: ${link}` : "分享失败");
  }

  async run() {
    try {
      if (!await this.jwt()) { invalid.push(maskAccount(this.account)); return; }
      await this.signin();
      await this.clickDaily();
      await this.processTaskList("sign_in_3", "cloud_app");
      await this.cloudGame();
      await this.wxSign();
      await this.shake();
      await this.draw();
      await this.backupCloud();
      await this.messagePush();
      await this.processTaskList("newsign_139mail", "email_app");
      await this.receiveClouds();
      if (config.uploadEnabled) await this.uploadLargeFile();
      if (config.shareEnabled) await this.shareFile();
    } catch (e) {
      const text = `${maskAccount(this.account)}: ${e.message || String(e)}`;
      errors.push(text);
      accountLog(this.account, `执行异常: ${e.message || e}`);
    }
  }
}

async function notify(summary) {
  if (!config.push) return;
  const candidates = ["./sendNotify", "/ql/data/scripts/sendNotify", "/ql/scripts/sendNotify"];
  for (const p of candidates) {
    try {
      const mod = require(p);
      if (typeof mod.sendNotify === "function") {
        await mod.sendNotify(TITLE, summary);
        return;
      }
    } catch {}
  }
}

function summary() {
  const parts = [];
  if (invalid.length) parts.push(`失效账号:\n${invalid.join("\n")}`);
  if (amounts.length) parts.push(`云朵统计:\n${amounts.join("\n")}`);
  if (errors.length) parts.push(`异常信息:\n${errors.join("\n")}`);
  return parts.join("\n\n") || "执行完成";
}

(async () => {
  const raw = String(process.env[ENV_NAME] || "").trim();
  if (!raw) {
    log(`❌ 未添加环境变量 ${ENV_NAME}`);
    process.exitCode = 1;
    return;
  }
  const accounts = raw.split(/[@\n]/).map((x) => x.trim()).filter(Boolean);
  log(`${TITLE} 共获取到 ${accounts.length} 个账号`);
  for (let i = 0; i < accounts.length; i++) {
    log(`\n======== 第 ${i + 1} 个账号 ========`);
    await new MobileCloudAccount(accounts[i], i + 1).run();
    if (i < accounts.length - 1) await sleep(randomInt(5000, 10000));
  }
  const text = summary();
  log(`\n${text}`);
  await notify(text);
  log("中国移动云盘任务执行结束");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
