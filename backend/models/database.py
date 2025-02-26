import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
load_dotenv()

# 使用MySQL (或MariaDB)
#SQLALCHEMY_DATABASE_URL = "mysql+pymysql://chatbot_user:pass@localhost/chatbot_db"

# 从环境变量读取数据库连接字符串
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://chatbot_user:pass@localhost/chatbot_db")


# 创建引擎
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 创建SessionLocal类
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明基类
Base = declarative_base()

# 获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
