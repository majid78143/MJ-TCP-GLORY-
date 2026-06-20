from flask import render_template, session, request, jsonify, redirect, url_for
from . import admin_bp
from utils.helpers import admin_required, ts, generate_id, generate_coupon
from utils.firebase_client import db_get, db_set, db_update, db_delete

@admin_bp.route("/")
@admin_required
def index():
    users = db_get("users") or {}
    user_count = len(users) if isinstance(users, dict) else 0
    transactions = db_get("pending_deposits") or {}
    pending_dep = len(transactions) if isinstance(transactions, dict) else 0
    withdrawals = db_get("pending_withdrawals") or {}
    pending_with = len(withdrawals) if isinstance(withdrawals, dict) else 0
    creators = db_get("creator_applications") or {}
    pending_creators = len([v for v in creators.values() if v.get("status") == "pending"]) if isinstance(creators, dict) else 0
    return render_template("admin/index.html", user_count=user_count,
        pending_dep=pending_dep, pending_with=pending_with, pending_creators=pending_creators)

@admin_bp.route("/users")
@admin_required
def users():
    all_users = db_get("users") or {}
    user_list = list(all_users.values()) if isinstance(all_users, dict) else []
    user_list.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    return render_template("admin/users.html", users=user_list)

@admin_bp.route("/payments")
@admin_required
def payments():
    deposits = db_get("pending_deposits") or {}
    withdrawals = db_get("pending_withdrawals") or {}
    dep_list = list(deposits.values()) if isinstance(deposits, dict) else []
    with_list = list(withdrawals.values()) if isinstance(withdrawals, dict) else []
    return render_template("admin/payments.html", deposits=dep_list, withdrawals=with_list)

@admin_bp.route("/banners")
@admin_required
def banners():
    banners = db_get("banners") or {}
    banner_list = list(banners.values()) if isinstance(banners, dict) else []
    return render_template("admin/banners.html", banners=banner_list)

@admin_bp.route("/events")
@admin_required
def events():
    events = db_get("events") or {}
    event_list = list(events.values()) if isinstance(events, dict) else []
    return render_template("admin/events.html", events=event_list)

@admin_bp.route("/creators")
@admin_required
def creators():
    applications = db_get("creator_applications") or {}
    app_list = list(applications.values()) if isinstance(applications, dict) else []
    approved = db_get("creators") or {}
    approved_list = list(approved.values()) if isinstance(approved, dict) else []
    return render_template("admin/creators.html", applications=app_list, creators=approved_list)

@admin_bp.route("/coupons")
@admin_required
def coupons():
    coupons = db_get("coupons") or {}
    coupon_list = list(coupons.values()) if isinstance(coupons, dict) else []
    return render_template("admin/coupons.html", coupons=coupon_list)

@admin_bp.route("/settings")
@admin_required
def settings():
    payment_settings = db_get("settings/payment") or {}
    social_settings = db_get("settings/socials") or {}
    image_settings = db_get("settings/image_hosting") or {}
    maintenance = db_get("settings/maintenance") or False
    return render_template("admin/settings.html",
        payment_settings=payment_settings, social_settings=social_settings,
        image_settings=image_settings, maintenance=maintenance)

@admin_bp.route("/logs")
@admin_required
def logs():
    logs_data = db_get("logs") or {}
    logs_list = sorted(logs_data.values(), key=lambda x: x.get("time", 0), reverse=True)[:100] if isinstance(logs_data, dict) else []
    return render_template("admin/logs.html", logs=logs_list)

@admin_bp.route("/api/approve-deposit", methods=["POST"])
@admin_required
def approve_deposit():
    data = request.get_json()
    tx_id = data.get("tx_id")
    tx = db_get(f"pending_deposits/{tx_id}")
    if not tx:
        return jsonify({"error": "Not found"}), 404
    uid = tx["uid"]
    amount = float(tx["amount"])
    profile = db_get(f"users/{uid}") or {}
    new_balance = float(profile.get("balance", 0)) + amount
    db_set(f"users/{uid}/balance", new_balance)
    db_set(f"transactions/{uid}/{tx_id}/status", "approved")
    db_delete(f"pending_deposits/{tx_id}")
    _log(f"Deposit approved: {tx_id} for user {uid}, amount {amount}")
    return jsonify({"success": True})

@admin_bp.route("/api/reject-deposit", methods=["POST"])
@admin_required
def reject_deposit():
    data = request.get_json()
    tx_id = data.get("tx_id")
    tx = db_get(f"pending_deposits/{tx_id}")
    if not tx:
        return jsonify({"error": "Not found"}), 404
    uid = tx["uid"]
    db_set(f"transactions/{uid}/{tx_id}/status", "rejected")
    db_delete(f"pending_deposits/{tx_id}")
    _log(f"Deposit rejected: {tx_id} for user {uid}")
    return jsonify({"success": True})

@admin_bp.route("/api/approve-withdrawal", methods=["POST"])
@admin_required
def approve_withdrawal():
    data = request.get_json()
    tx_id = data.get("tx_id")
    tx = db_get(f"pending_withdrawals/{tx_id}")
    if not tx:
        return jsonify({"error": "Not found"}), 404
    uid = tx["uid"]
    db_set(f"transactions/{uid}/{tx_id}/status", "approved")
    db_delete(f"pending_withdrawals/{tx_id}")
    _log(f"Withdrawal approved: {tx_id} for user {uid}")
    return jsonify({"success": True})

@admin_bp.route("/api/ban-user", methods=["POST"])
@admin_required
def ban_user():
    data = request.get_json()
    uid = data.get("uid")
    db_set(f"users/{uid}/banned", True)
    _log(f"User banned: {uid}")
    return jsonify({"success": True})

@admin_bp.route("/api/set-vip", methods=["POST"])
@admin_required
def set_vip():
    data = request.get_json()
    uid = data.get("uid")
    level = int(data.get("level", 0))
    from utils.helpers import VIP_THRESHOLDS
    xp = VIP_THRESHOLDS[level] if 0 <= level <= 10 else 0
    db_update(f"users/{uid}", {"vip_level": level, "vip_xp": xp})
    _log(f"VIP level set: {uid} -> VIP{level}")
    return jsonify({"success": True})

@admin_bp.route("/api/add-balance", methods=["POST"])
@admin_required
def add_balance():
    data = request.get_json()
    uid = data.get("uid")
    amount = float(data.get("amount", 0))
    profile = db_get(f"users/{uid}") or {}
    new_balance = float(profile.get("balance", 0)) + amount
    db_set(f"users/{uid}/balance", new_balance)
    _log(f"Balance added: {uid} +{amount}")
    return jsonify({"success": True, "balance": new_balance})

@admin_bp.route("/api/create-coupon", methods=["POST"])
@admin_required
def create_coupon():
    data = request.get_json()
    code = data.get("code") or generate_coupon()
    value = float(data.get("value", 100))
    single_use = data.get("single_use", True)
    expires_days = int(data.get("expires_days", 30))
    coupon = {
        "code": code, "value": value, "single_use": single_use,
        "used": False, "redeemed_by": [],
        "created_at": ts(),
        "expires_at": ts() + (expires_days * 86400 * 1000)
    }
    db_set(f"coupons/{code}", coupon)
    _log(f"Coupon created: {code}, value {value}")
    return jsonify({"success": True, "code": code})

@admin_bp.route("/api/create-event", methods=["POST"])
@admin_required
def create_event():
    data = request.get_json()
    event_id = generate_id()
    event = {
        "id": event_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "type": data.get("type", "daily"),
        "reward": data.get("reward", ""),
        "active": True,
        "created_at": ts(),
        "end_at": ts() + int(data.get("duration_hours", 24)) * 3600000
    }
    db_set(f"events/{event_id}", event)
    _log(f"Event created: {event_id}")
    return jsonify({"success": True, "event_id": event_id})

@admin_bp.route("/api/create-banner", methods=["POST"])
@admin_required
def create_banner():
    data = request.get_json()
    banner_id = generate_id()
    banner = {
        "id": banner_id,
        "title": data.get("title", ""),
        "image": data.get("image", ""),
        "link": data.get("link", ""),
        "active": True,
        "created_at": ts()
    }
    db_set(f"banners/{banner_id}", banner)
    return jsonify({"success": True, "banner_id": banner_id})

@admin_bp.route("/api/approve-creator", methods=["POST"])
@admin_required
def approve_creator():
    data = request.get_json()
    uid = data.get("uid")
    app = db_get(f"creator_applications/{uid}")
    if not app:
        return jsonify({"error": "Application not found"}), 404
    ref_code = "REF" + uid[:8].upper()
    creator = {**app, "approved": True, "approved_at": ts(), "ref_code": ref_code, "total_referrals": 0, "total_earnings": 0}
    db_set(f"creators/{uid}", creator)
    db_set(f"creator_applications/{uid}/status", "approved")
    db_set(f"users/{uid}/is_creator", True)
    _log(f"Creator approved: {uid}")
    return jsonify({"success": True, "ref_code": ref_code})

@admin_bp.route("/api/save-settings", methods=["POST"])
@admin_required
def save_settings():
    data = request.get_json()
    section = data.get("section")
    settings_data = data.get("data", {})
    if section in ["payment", "socials", "image_hosting"]:
        db_set(f"settings/{section}", settings_data)
        _log(f"Settings updated: {section}")
        return jsonify({"success": True})
    return jsonify({"error": "Invalid section"}), 400

@admin_bp.route("/api/toggle-maintenance", methods=["POST"])
@admin_required
def toggle_maintenance():
    current = db_get("settings/maintenance") or False
    db_set("settings/maintenance", not current)
    return jsonify({"success": True, "maintenance": not current})

@admin_bp.route("/api/upload-image", methods=["POST"])
@admin_required
def upload_image():
    settings = db_get("settings/image_hosting") or {}
    provider = settings.get("provider", "firebase")
    if provider == "imgbb":
        api_key = settings.get("api_key", "")
        file = request.files.get("image")
        if not file:
            return jsonify({"error": "No file"}), 400
        import base64, requests as req
        img_data = base64.b64encode(file.read()).decode("utf-8")
        r = req.post(f"https://api.imgbb.com/1/upload?key={api_key}", data={"image": img_data})
        result = r.json()
        if result.get("success"):
            return jsonify({"success": True, "url": result["data"]["url"]})
        return jsonify({"error": "Upload failed"}), 500
    return jsonify({"error": "Provider not configured"}), 400

def _log(message):
    log_id = generate_id()
    admin_uid = session.get("user", {}).get("uid", "admin")
    db_set(f"logs/{log_id}", {"message": message, "admin": admin_uid, "time": ts()})

