import os
import secrets
import logging
from datetime import timedelta
from flask import Flask
from dotenv import load_dotenv
from models import db

logger = logging.getLogger(__name__)


def create_app(config_override=None) -> Flask:
    """
    Application factory for ClipAI Studio.
    Creates and configures a lightweight Flask application instance with database connection
    and security headers without executing module-level side-effects (like queue polling or cleanup sweeps).
    """
    load_dotenv()
    flask_env = os.getenv('FLASK_ENV', 'development').lower()

    app = Flask(__name__)

    # Production environment check
    if flask_env == 'production':
        required_prod_secrets = ['SECRET_KEY', 'GROQ_API_KEY', 'YOUTUBE_API_KEY', 'ADMIN_API_KEY']
        missing_secrets = [var for var in required_prod_secrets if not os.getenv(var)]
        if missing_secrets:
            raise RuntimeError(
                f"CRITICAL PRODUCTION SECURITY ERROR: The following required environment variables are missing: "
                f"{', '.join(missing_secrets)}. You must set all required secrets before running in production."
            )

    # Secret Key Handling
    secret_key = os.getenv('SECRET_KEY')
    if not secret_key:
        if flask_env == 'production':
            raise RuntimeError("CRITICAL PRODUCTION SECURITY ERROR: SECRET_KEY environment variable must be set.")
        secret_key = secrets.token_hex(32)
        logger.warning("SECURITY WARNING: SECRET_KEY not configured in environment. Generated an ephemeral development key.")

    app.config['SECRET_KEY'] = secret_key
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI', 'sqlite:///yt_upl2.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 2 GB upload limit
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    # Only transmit session cookies over HTTPS in production
    app.config['SESSION_COOKIE_SECURE'] = (flask_env == 'production')

    if config_override:
        app.config.update(config_override)

    # Initialize SQLAlchemy with app
    db.init_app(app)

    @app.after_request
    def add_security_headers(response):
        """Attach security response headers to every outbound response.

        Cross-Origin-Opener-Policy is set to 'same-origin-allow-popups' rather than
        'same-origin' to allow the Google OAuth popup flow to post a message back to
        the opener window without being blocked by the browser.
        """
        # Google OAuth popup compatibility
        response.headers['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
        response.headers['Cross-Origin-Embedder-Policy'] = 'unsafe-none'

        # Prevent MIME-type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'

        # Disallow framing this app in any foreign origin
        response.headers['X-Frame-Options'] = 'DENY'

        # Send only origin (no path/query) in the Referer header to external sites
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Opt out of unused browser features
        response.headers['Permissions-Policy'] = (
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
        )

        # HSTS: only in production — dev browsers must not cache this
        if flask_env == 'production':
            response.headers['Strict-Transport-Security'] = (
                'max-age=63072000; includeSubDomains; preload'
            )

        return response

    return app
