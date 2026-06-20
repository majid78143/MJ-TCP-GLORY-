import os
from flask import Flask, render_template, session, redirect, url_for
from config import config, FIREBASE_CONFIG
from blueprints.auth import auth_bp
from blueprints.home import home_bp
from blueprints.wallet import wallet_bp
from blueprints.profile import profile_bp
from blueprints.games import games_bp
from blueprints.events import events_bp
from blueprints.leaderboard import leaderboard_bp
from blueprints.support import support_bp
from blueprints.settings import settings_bp
from blueprints.creator import creator_bp
from blueprints.admin import admin_bp
from blueprints.api import api_bp

def create_app(config_name="default"):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(home_bp, url_prefix="/")
    app.register_blueprint(wallet_bp, url_prefix="/wallet")
    app.register_blueprint(profile_bp, url_prefix="/profile")
    app.register_blueprint(games_bp, url_prefix="/games")
    app.register_blueprint(events_bp, url_prefix="/events")
    app.register_blueprint(leaderboard_bp, url_prefix="/leaderboard")
    app.register_blueprint(support_bp, url_prefix="/support")
    app.register_blueprint(settings_bp, url_prefix="/settings")
    app.register_blueprint(creator_bp, url_prefix="/creator")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.context_processor
    def inject_globals():
        return {
            "firebase_config": FIREBASE_CONFIG,
            "app_name": "19GameVIP",
            "current_user": session.get("user"),
        }

    @app.errorhandler(404)
    def not_found(e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(e):
        return render_template("errors/500.html"), 500

    return app

app = create_app(os.environ.get("FLASK_ENV", "development"))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
