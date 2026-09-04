#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
new Env('Single-阿里云盘签到');
cron: 10 6,18 * * *

来源改编：smallfawn/QLScriptPublic daily/aliyunpan.py
青龙环境变量：single_aliyun_accounts

格式：refresh_token#备注名
多账号：使用 & 或换行分隔。
"""

import logging
import os
import random
import re
import time
from typing import Dict

import requests

ENV_NAME = "single_aliyun_accounts"
TITLE = "阿里云盘签到"
TIMEOUT = 15

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("SingleAliYun")


def send_notify(title: str, content: str):
    try:
        from notify import send
        send(title, content)
    except Exception:
        logger.info("\n【%s】\n%s", title, content)


class AliYun:
    def __init__(self, name: str, refresh_token: str):
        self.session = requests.Session()
        self.name = name
        self.refresh_token = refresh_token
        self.access_token = ""
        self.headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) "
                          "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AlphaDrive/3.0.0",
            "Content-Type": "application/json; charset=utf-8",
        }

    def refresh_access_token(self) -> bool:
        url = "https://auth.aliyundrive.com/v2/account/token"
        payload = {"grant_type": "refresh_token", "refresh_token": self.refresh_token}
        try:
            res = self.session.post(url, json=payload, timeout=TIMEOUT).json()
            if res.get("access_token"):
                self.access_token = res["access_token"]
                self.refresh_token = res.get("refresh_token", self.refresh_token)
                return True
            logger.error("[%s] 刷新 Token 失败: %s", self.name, res.get("message", "未知错误"))
        except Exception as exc:
            logger.error("[%s] 刷新 Token 请求异常: %s", self.name, exc)
        return False

    def auth_headers(self):
        return {**self.headers, "Authorization": f"Bearer {self.access_token}"}

    def check_in(self) -> Dict:
        url = "https://member.aliyundrive.com/v1/activity/sign_in_list"
        try:
            return self.session.post(
                url,
                params={"_rx-s": "mobile"},
                json={"isReward": False},
                headers=self.auth_headers(),
                timeout=TIMEOUT,
            ).json()
        except Exception as exc:
            return {"success": False, "message": str(exc)}

    def get_reward(self, day: int) -> str:
        url = "https://member.aliyundrive.com/v1/activity/sign_in_reward"
        try:
            res = self.session.post(
                url,
                params={"_rx-s": "mobile"},
                json={"signInDay": day},
                headers=self.auth_headers(),
                timeout=TIMEOUT,
            ).json()
            return res.get("result", {}).get("notice", res.get("message", "未获取到奖励明细"))
        except Exception as exc:
            return f"奖励领取异常: {exc}"

    def get_capacity(self) -> str:
        url = "https://api.aliyundrive.com/adrive/v1/user/driveCapacityDetails"

        def fmt(size):
            try:
                size = float(size)
                return f"{size / 1024 / 1024 / 1024:.2f} GB" if size > 0 else "0 GB"
            except Exception:
                return "未知"

        try:
            res = self.session.post(
                url,
                json={},
                headers=self.auth_headers(),
                timeout=TIMEOUT,
            ).json()
            return (
                f"总空间: {fmt(res.get('drive_total_size', 0))}\n"
                f"已用空间: {fmt(res.get('drive_used_size', 0))}"
            )
        except Exception as exc:
            return f"容量查询失败: {exc}"

    def run(self):
        logger.info("--- 账号 [%s] 开始签到 ---", self.name)
        if not self.refresh_access_token():
            return f"【{self.name}】❌ 登录失效"

        res = self.check_in()
        if not res.get("success"):
            return f"【{self.name}】❌ 签到失败: {res.get('message', '未知错误')}"

        count = res.get("result", {}).get("signInCount", 0)
        reward = self.get_reward(count)
        capacity = self.get_capacity()
        return (
            f"【{self.name}】✅ 签到成功\n"
            f"本月累计签到: {count} 天\n"
            f"本次奖励: {reward}\n"
            f"{capacity}"
        )


def parse_accounts(raw: str):
    result = []
    for idx, item in enumerate(re.split(r"[&\n]+", raw.strip()), 1):
        item = item.strip()
        if not item:
            continue
        token, sep, remark = item.partition("#")
        token = token.strip()
        if not token:
            continue
        result.append((remark.strip() if sep and remark.strip() else f"账号{idx}", token))
    return result


def main():
    raw = os.getenv(ENV_NAME, "").strip()
    if not raw:
        msg = f"❌ 未找到环境变量 {ENV_NAME}"
        logger.error(msg)
        send_notify(TITLE, msg)
        return

    accounts = parse_accounts(raw)
    logger.info("共检测到 %d 个阿里云盘账号", len(accounts))
    reports = []

    for idx, (name, token) in enumerate(accounts):
        try:
            reports.append(AliYun(name, token).run())
        except Exception as exc:
            logger.exception("账号 %s 执行异常", name)
            reports.append(f"【{name}】❌ 执行异常: {exc}")
        if idx < len(accounts) - 1:
            time.sleep(random.randint(3, 8))

    content = "\n\n".join(reports)
    print("\n" + content)
    send_notify(TITLE, content)


if __name__ == "__main__":
    main()
