from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import assistant, conversation, websocket, auth, embed, mfa, tts
from models.database import Base, engine
from utils.logger import setup_logging, get_logger

# 日誌：寫入 ./log/yyyyMMdd.log
setup_logging()
logger = get_logger(__name__)

# 初始化数据库
Base.metadata.create_all(bind=engine)

app = FastAPI()


@app.on_event("startup")
def startup_event():
    logger.info("Application started.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# 配置静态文件路由
app.mount("/public", StaticFiles(directory="public"), name="public")

# 包含助理、对话、WebSocket路由
app.include_router(assistant.router)
app.include_router(conversation.router)
app.include_router(websocket.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(mfa.router, prefix="/auth/mfa")
app.include_router(embed.router)
app.include_router(tts.router)
