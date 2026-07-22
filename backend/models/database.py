import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
load_dotenv()

# 使用MySQL (或MariaDB)
#SQLALCHEMY_DATABASE_URL = "mysql+pymysql://chatbot_user:pass@mariadb:3306/chatbot_db"

# 從環境變數讀取資料庫連線字串
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://chatbot_user:pass@mariadb:3306/chatbot_db")


# 建立引擎（pool_pre_ping / pool_recycle 避免閒置連線被 MySQL 關閉後仍被重用）
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "30"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "30"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "60"))

_engine_kwargs: dict = {
    "pool_pre_ping": True,
    "pool_recycle": 3600,
}
if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _engine_kwargs.update(
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_timeout=DB_POOL_TIMEOUT,
    )

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)

# 建立 SessionLocal 類別
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 宣告基類
Base = declarative_base()

# 取得資料庫工作階段
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_conversations_client_ip_column(engine: Engine) -> None:
    """啟動時補上舊資料庫缺少的 client_ip 欄位（忽略已存在；不回填舊列）。"""
    url = str(engine.url)
    with engine.connect() as conn:
        if "sqlite" in url.lower():
            try:
                conn.execute(
                    text(
                        "ALTER TABLE conversations ADD COLUMN client_ip "
                        "VARCHAR(45) NOT NULL DEFAULT '---'"
                    )
                )
                conn.commit()
            except Exception:
                conn.rollback()
        elif "mysql" in url.lower():
            try:
                conn.execute(
                    text(
                        "ALTER TABLE conversations ADD COLUMN client_ip "
                        "VARCHAR(45) NOT NULL DEFAULT '---'"
                    )
                )
                conn.commit()
            except Exception:
                conn.rollback()
