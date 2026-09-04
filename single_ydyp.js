/*
new Env('Single-中国移动云盘');
cron: 8 10 * * *

核心来源：smallfawn/QLScriptPublic daily/ydyp.js
本文件负责将 single_ 前缀环境变量映射给已内置的上游核心代码。

必填：
  single_ydyp_ck

可选：
  single_ydyp_upload
  single_ydyp_dir_id
  single_ydyp_upload_filename
  single_ydyp_upload_size_mb
  single_ydyp_share
  single_ydyp_share_filename
  single_ydyp_push
  single_ydyp_click_num
  single_ydyp_draw_times
  single_ydyp_delay_min
  single_ydyp_delay_max
  single_ydyp_timeout
*/

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ENV_MAP = {
  single_ydyp_ck: "ydyp_ck",
  single_ydyp_upload: "CLOUD139_UPLOAD",
  single_ydyp_dir_id: "CLOUD139_DIR_ID",
  single_ydyp_upload_filename: "CLOUD139_UPLOAD_FILENAME",
  single_ydyp_upload_size_mb: "CLOUD139_UPLOAD_SIZE_MB",
  single_ydyp_share: "CLOUD139_SHARE",
  single_ydyp_share_filename: "CLOUD139_SHARE_FILENAME",
  single_ydyp_push: "CLOUD139_PUSH",
  single_ydyp_click_num: "CLOUD139_CLICK_NUM",
  single_ydyp_draw_times: "CLOUD139_DRAW_TIMES",
  single_ydyp_delay_min: "CLOUD139_DELAY_MIN",
  single_ydyp_delay_max: "CLOUD139_DELAY_MAX",
  single_ydyp_timeout: "CLOUD139_TIMEOUT",
};

for (const [source, target] of Object.entries(ENV_MAP)) {
  if (process.env[source] !== undefined && process.env[source] !== "") {
    process.env[target] = process.env[source];
  }
}

if (!process.env.single_ydyp_ck) {
  console.error("❌ 未添加环境变量 single_ydyp_ck");
  process.exit(1);
}

const coreFile = path.join(__dirname, "upstream", "ydyp.core");
if (!fs.existsSync(coreFile)) {
  console.error(`❌ 缺少中国移动云盘核心文件：${coreFile}`);
  console.error("请重新拉取仓库，确认 upstream/ydyp.core 已存在。");
  process.exit(1);
}

let code = fs.readFileSync(coreFile, "utf8");

// 上游 Node.js 版本在 finally 中固定 process.exit(1)，即使正常执行也会被青龙标红。
// 这里只修正最终退出码为 0，不改动任务逻辑。
code = code.replace(
  't.log("🚩 执行结束!"), process.exit(1);',
  't.log("🚩 执行结束!"), process.exit(0);'
);

const mod = new Module(coreFile, module);
mod.filename = coreFile;
mod.paths = Module._nodeModulePaths(path.dirname(coreFile));
mod._compile(code, coreFile);
