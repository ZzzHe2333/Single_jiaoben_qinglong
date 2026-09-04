/*
new Env('Single-聚合签到');
cron: 15 9 * * *

青龙唯一执行入口：node single.js

自动检测环境变量：
  single_ydyp_ck           -> 中国移动云盘
  single_quark             -> 夸克网盘
  single_wps               -> WPS
  single_aliyun_accounts   -> 阿里云盘

配置哪个就执行哪个；同时配置多个则按顺序全部执行。
*/

const axios = require("axios");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = __dirname;
const MODULES = [
  { key: "single_ydyp_ck", name: "中国移动云盘", type: "helper", file: path.join(ROOT, "lib", "ydyp.inc") },
  { key: "single_quark", name: "夸克网盘", type: "internal", run: runQuark },
  { key: "single_wps", name: "WPS", type: "helper", file: path.join(ROOT, "lib", "wps.inc") },
  { key: "single_aliyun_accounts", name: "阿里云盘", type: "internal", run: runAliyun },
];

function section(title) {
  console.log(`\n================ ${title} ================`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitAccounts(raw, regex) {
  return String(raw || "")
    .split(regex)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function sendNotify(title, content) {
  const candidates = ["./sendNotify", "/ql/data/scripts/sendNotify", "/ql/scripts/sendNotify"];
  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      if (typeof mod.sendNotify === "function") {
        await mod.sendNotify(title, content);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

function runHelper(file, name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", (err) => {
      console.error(`❌ ${name} 启动失败：${err.message || err}`);
      resolve(false);
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        console.log(`✅ ${name} 执行结束`);
        resolve(true);
      } else {
        console.error(`❌ ${name} 返回异常状态：code=${code}, signal=${signal || "-"}`);
        resolve(false);
      }
    });
  });
}

function formatBytes(value) {
  let n = Number(value || 0);
  if (!Number.isFinite(n)) return String(value ?? "");
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(2)} ${units[i]}`;
}

function parseKvAccount(raw) {
  const out = {};
  for (const part of String(raw || "").split(";")) {
    const text = part.trim();
    if (!text || !text.includes("=")) continue;
    const pos = text.indexOf("=");
    out[text.slice(0, pos).trim()] = text.slice(pos + 1).trim();
  }
  if (out.url) {
    try {
      const u = new URL(out.url);
      for (const key of ["kps", "sign", "vcode"]) {
        if (u.searchParams.get(key)) out[key] = u.searchParams.get(key);
      }
    } catch (_) {}
  }
  return out;
}

async function runQuark() {
  const raw = String(process.env.single_quark || "").trim();
  const accounts = splitAccounts(raw, /\n|&&/);
  if (!accounts.length) return true;

  const reports = [];
  console.log(`共检测到 ${accounts.length} 个夸克账号`);

  for (let i = 0; i < accounts.length; i++) {
    const account = parseKvAccount(accounts[i]);
    const name = account.user || `账号${i + 1}`;
    const params = {
      pr: "ucpro",
      fr: "android",
      kps: account.kps || "",
      sign: account.sign || "",
      vcode: account.vcode || "",
    };

    const missing = ["kps", "sign", "vcode"].filter((k) => !params[k]);
    if (missing.length) {
      const msg = `【${name}】❌ 缺少参数：${missing.join(", ")}`;
      console.log(msg);
      reports.push(msg);
      continue;
    }

    try {
      const infoRes = await axios.get(
        "https://drive-m.quark.cn/1/clouddrive/capacity/growth/info",
        { params, timeout: 20000 }
      );
      const info = infoRes.data?.data;
      if (!info) {
        const msg = `【${name}】❌ 获取成长信息失败，登录参数可能已失效`;
        console.log(msg);
        reports.push(msg);
        continue;
      }

      const vip = info["88VIP"] ? "88VIP" : "普通用户";
      const composition = info.cap_composition || {};
      const capSign = info.cap_sign || {};
      const lines = [
        `【${name}】`,
        `👤 ${vip}`,
        `💾 网盘总容量：${formatBytes(info.total_capacity || 0)}`,
        `📦 签到累计容量：${formatBytes(composition.sign_reward || 0)}`,
      ];

      if (capSign.sign_daily) {
        lines.push(
          `✅ 今日已签到 +${formatBytes(capSign.sign_daily_reward || 0)}，连签进度 ${capSign.sign_progress || 0}/${capSign.sign_target || 0}`
        );
      } else {
        const signRes = await axios.post(
          "https://drive-m.quark.cn/1/clouddrive/capacity/growth/sign",
          { sign_cyclic: true },
          { params, timeout: 20000 }
        );
        if (signRes.data?.data) {
          const reward = signRes.data.data.sign_daily_reward || 0;
          lines.push(
            `✅ 签到成功 +${formatBytes(reward)}，连签进度 ${(capSign.sign_progress || 0) + 1}/${capSign.sign_target || 0}`
          );
        } else {
          lines.push(`❌ 签到失败：${signRes.data?.message || signRes.data?.msg || "未知错误"}`);
        }
      }

      const report = lines.join("\n");
      console.log(report);
      reports.push(report);
    } catch (err) {
      const msg = `【${name}】❌ 执行异常：${err.response?.data?.message || err.message || err}`;
      console.log(msg);
      reports.push(msg);
    }

    if (i < accounts.length - 1) await sleep(1000);
  }

  const content = reports.join("\n\n");
  await sendNotify("夸克自动签到", content);
  return !reports.some((x) => x.includes("❌"));
}

function parseAliyunAccounts(raw) {
  const list = [];
  const items = splitAccounts(raw, /[&\n]+/);
  for (let i = 0; i < items.length; i++) {
    const [token, ...remarkParts] = items[i].split("#");
    const refreshToken = String(token || "").trim();
    if (!refreshToken) continue;
    const remark = remarkParts.join("#").trim() || `账号${i + 1}`;
    list.push({ refreshToken, remark });
  }
  return list;
}

function aliyunHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=utf-8",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AlphaDrive/3.0.0",
  };
}

function formatAliyunCapacity(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 GB";
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function runAliyun() {
  const raw = String(process.env.single_aliyun_accounts || "").trim();
  const accounts = parseAliyunAccounts(raw);
  if (!accounts.length) return true;

  const reports = [];
  console.log(`共检测到 ${accounts.length} 个阿里云盘账号`);

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    try {
      const tokenRes = await axios.post(
        "https://auth.aliyundrive.com/v2/account/token",
        {
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
        },
        { timeout: 15000 }
      );

      const accessToken = tokenRes.data?.access_token;
      if (!accessToken) {
        const msg = `【${account.remark}】❌ refresh_token 失效：${tokenRes.data?.message || "未知错误"}`;
        console.log(msg);
        reports.push(msg);
        continue;
      }

      const headers = aliyunHeaders(accessToken);
      const signRes = await axios.post(
        "https://member.aliyundrive.com/v1/activity/sign_in_list",
        { isReward: false },
        {
          headers,
          params: { "_rx-s": "mobile" },
          timeout: 15000,
        }
      );

      if (!signRes.data?.success) {
        const msg = `【${account.remark}】❌ 签到失败：${signRes.data?.message || "未知错误"}`;
        console.log(msg);
        reports.push(msg);
        continue;
      }

      const count = Number(signRes.data?.result?.signInCount || 0);
      let reward = "未获取到奖励明细";
      try {
        const rewardRes = await axios.post(
          "https://member.aliyundrive.com/v1/activity/sign_in_reward",
          { signInDay: count },
          {
            headers,
            params: { "_rx-s": "mobile" },
            timeout: 15000,
          }
        );
        reward = rewardRes.data?.result?.notice || rewardRes.data?.message || reward;
      } catch (err) {
        reward = `奖励领取异常：${err.message || err}`;
      }

      let capacity = "容量查询失败";
      try {
        const capRes = await axios.post(
          "https://api.aliyundrive.com/adrive/v1/user/driveCapacityDetails",
          {},
          { headers, timeout: 15000 }
        );
        capacity = `总空间: ${formatAliyunCapacity(capRes.data?.drive_total_size)}\n已用空间: ${formatAliyunCapacity(capRes.data?.drive_used_size)}`;
      } catch (err) {
        capacity = `容量查询失败：${err.message || err}`;
      }

      const msg = [
        `【${account.remark}】✅ 签到成功`,
        `本月累计签到: ${count} 天`,
        `本次奖励: ${reward}`,
        capacity,
      ].join("\n");
      console.log(msg);
      reports.push(msg);
    } catch (err) {
      const msg = `【${account.remark}】❌ 执行异常：${err.response?.data?.message || err.message || err}`;
      console.log(msg);
      reports.push(msg);
    }

    if (i < accounts.length - 1) await sleep(3000);
  }

  const content = reports.join("\n\n");
  await sendNotify("阿里云盘签到", content);
  return !reports.some((x) => x.includes("❌"));
}

async function main() {
  const enabled = MODULES.filter((item) => String(process.env[item.key] || "").trim());

  console.log("Single 聚合签到启动");
  console.log(`已配置模块：${enabled.length ? enabled.map((x) => x.name).join("、") : "无"}`);

  if (!enabled.length) {
    console.error("\n❌ 未检测到任何可执行环境变量。至少配置以下一个：");
    console.error("single_ydyp_ck");
    console.error("single_quark");
    console.error("single_wps");
    console.error("single_aliyun_accounts");
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const item of enabled) {
    section(item.name);
    let ok = false;
    try {
      ok = item.type === "helper"
        ? await runHelper(item.file, item.name)
        : await item.run();
    } catch (err) {
      console.error(`❌ ${item.name} 执行异常：${err.message || err}`);
      ok = false;
    }
    results.push({ name: item.name, ok });
  }

  section("执行汇总");
  for (const result of results) {
    console.log(`${result.ok ? "✅" : "❌"} ${result.name}`);
  }

  const failed = results.filter((x) => !x.ok);
  if (failed.length) {
    console.error(`\n完成，但有 ${failed.length} 个模块出现异常。`);
    process.exitCode = 1;
  } else {
    console.log("\n全部已配置模块执行完成。" );
  }
}

main().catch((err) => {
  console.error(`聚合脚本异常：${err.stack || err.message || err}`);
  process.exitCode = 1;
});
