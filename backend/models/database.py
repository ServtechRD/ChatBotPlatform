import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
load_dotenv()

# 使用MySQL (或MariaDB)
#SQLALCHEMY_DATABASE_URL = "mysql+pymysql://chatbot_user:pass@localhost/chatbot_db"

# 從環境變數讀取資料庫連線字串
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://chatbot_user:pass@localhost/chatbot_db")


# 建立引擎
engine = create_engine(SQLALCHEMY_DATABASE_URL)

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
