#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
new Env('Single-夸克自动签到');
cron: 0 9 * * *

来源改编：smallfawn/QLScriptPublic daily/quark.py
青龙环境变量：single_quark

多账号：换行或 && 分隔。
推荐格式：
user=账号1; url=https://drive-m.quark.cn/1/clouddrive/act/growth/reward?...&kps=xxx&sign=xxx&vcode=xxx;
也兼容：user=账号1; kps=xxx; sign=xxx; vcode=xxx;
"""

import os
import re
import sys
from urllib.parse import urlparse, parse_qs

import requests

ENV_NAME = "single_quark"
TITLE = "夸克自动签到"
TIMEOUT = 20


def send_notify(title: str, content: str):
    """尽量调用青龙 notify.py；不存在时只打印，不影响任务。"""
    try:
        from notify import send
        send(title, content)
    except Exception:
        print(f"\n【{title}】\n{content}")


def get_accounts():
    raw = os.getenv(ENV_NAME, "").strip()
    if not raw:
        msg = f"❌ 未添加环境变量 {ENV_NAME}"
        print(msg)
        send_notify(TITLE, msg)
        sys.exit(1)
    return [x.strip() for x in re.split(r"\n|&&", raw) if x.strip()]


def parse_account(raw: str):
    data = {}
    for item in raw.split(";"):
        item = item.strip()
        if not item or "=" not in item:
            continue
        key, value = item.split("=", 1)
        data[key.strip()] = value.strip()

    if data.get("url"):
        qs = parse_qs(urlparse(data["url"]).query)
        for key in ("kps", "sign", "vcode"):
            if qs.get(key):
                data[key] = qs[key][0]
    return data


def convert_bytes(value):
    try:
        value = float(value)
    except Exception:
        return str(value)
    units = ("B", "KB", "MB", "GB", "TB", "PB")
    idx = 0
    while value >= 1024 and idx < len(units) - 1:
        value /= 1024
        idx += 1
    return f"{value:.2f} {units[idx]}"


class Quark:
    def __init__(self, account):
        self.account = account
        self.session = requests.Session()
        self.params = {
            "pr": "ucpro",
            "fr": "android",
            "kps": account.get("kps", ""),
            "sign": account.get("sign", ""),
            "vcode": account.get("vcode", ""),
        }

    def validate(self):
        missing = [k for k in ("kps", "sign", "vcode") if not self.params.get(k)]
        if missing:
            raise ValueError("缺少参数: " + ", ".join(missing))

    def growth_info(self):
        url = "https://drive-m.quark.cn/1/clouddrive/capacity/growth/info"
        res = self.session.get(url, params=self.params, timeout=TIMEOUT)
        res.raise_for_status()
        data = res.json()
        return data.get("data") or None

    def sign(self):
        url = "https://drive-m.quark.cn/1/clouddrive/capacity/growth/sign"
        res = self.session.post(
            url,
            params=self.params,
            json={"sign_cyclic": True},
            timeout=TIMEOUT,
        )
        res.raise_for_status()
        data = res.json()
        if data.get("data"):
            return True, data["data"].get("sign_daily_reward", 0)
        return False, data.get("message") or data.get("msg") or "未知错误"

    def run(self):
        self.validate()
        info = self.growth_info()
        if not info:
            return "❌ 获取成长信息失败，登录参数可能已失效"

        name = self.account.get("user") or "未备注账号"
        vip = "88VIP" if info.get("88VIP") else "普通用户"
        total = convert_bytes(info.get("total_capacity", 0))
        composition = info.get("cap_composition") or {}
        sign_total = convert_bytes(composition.get("sign_reward", 0))
        cap_sign = info.get("cap_sign") or {}
        progress = cap_sign.get("sign_progress", 0)
        target = cap_sign.get("sign_target", 0)

        lines = [
            f"👤 {vip} {name}",
            f"💾 网盘总容量：{total}",
            f"📦 签到累计容量：{sign_total}",
        ]

        if cap_sign.get("sign_daily"):
            reward = convert_bytes(cap_sign.get("sign_daily_reward", 0))
            lines.append(f"✅ 今日已签到 +{reward}，连签进度 {progress}/{target}")
        else:
            ok, result = self.sign()
            if ok:
                lines.append(
                    f"✅ 签到成功 +{convert_bytes(result)}，连签进度 {progress + 1}/{target}"
                )
            else:
                lines.append(f"❌ 签到失败：{result}")
        return "\n".join(lines)


def main():
    accounts = get_accounts()
    print(f"✅ 共检测到 {len(accounts)} 个夸克账号")
    reports = []

    for idx, raw in enumerate(accounts, 1):
        print(f"\n====== 第 {idx} 个账号 ======")
        try:
            report = Quark(parse_account(raw)).run()
        except Exception as exc:
            report = f"❌ 执行异常：{exc}"
        print(report)
        reports.append(f"【账号{idx}】\n{report}")

    content = "\n\n".join(reports)
    send_notify(TITLE, content)
    return content


if __name__ == "__main__":
    main()
