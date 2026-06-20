import os

FIREBASE_CONFIG = {
    "apiKey": "AIzaSyCuZDyri0F0ky2sHxFO-p2OKvEB2sQfihw",
    "authDomain": "dreamdrop-3ca3d.firebaseapp.com",
    "databaseURL": "https://dreamdrop-3ca3d-default-rtdb.firebaseio.com",
    "projectId": "dreamdrop-3ca3d",
    "storageBucket": "dreamdrop-3ca3d.firebasestorage.app",
    "messagingSenderId": "882827368473",
    "appId": "1:882827368473:web:bf146e6c9f5db32edbb288",
    "measurementId": "G-Z6B3CZZRC9"
}

class Config:
    SECRET_KEY = os.environ.get("SESSION_SECRET", "19gamevip-secret-2024")
    DEBUG = False
    TESTING = False
    FIREBASE_CONFIG = FIREBASE_CONFIG
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig
}

