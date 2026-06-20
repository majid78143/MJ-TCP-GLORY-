from flask import jsonify, session, request
from . import api_bp
from utils.firebase_client import db_get
from utils.helpers import ts

@api_bp.route("/status")
def status():
    maintenance = db_get("settings/maintenance") or False
    return jsonify({"status": "ok", "maintenance": maintenance, "time": ts()})

@api_bp.route("/user/balance")
def user_balance():
    user = session.get("user")
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    uid = user["uid"]
    profile = db_get(f"users/{uid}") or {}
    return jsonify({"balance": profile.get("balance", 0), "vip_level": profile.get("vip_level", 0)})

@api_bp.route("/leaderboard/<period>")
def leaderboard(period):
    if period not in ["daily", "weekly", "monthly", "alltime"]:
        return jsonify({"error": "Invalid period"}), 400
    data = db_get(f"leaderboards/{period}") or {}
    entries = list(data.values()) if isinstance(data, dict) else []
    entries = sorted(entries, key=lambda x: x.get("score", 0), reverse=True)[:10]
    return jsonify({"entries": entries})

@api_bp.route("/notifications/count")
def notification_count():
    user = session.get("user")
    if not user:
        return jsonify({"count": 0})
    uid = user["uid"]
    notifs = db_get(f"notifications/{uid}") or {}
    unread = sum(1 for n in notifs.values() if not n.get("read")) if isinstance(notifs, dict) else 0
    return jsonify({"count": unread})

