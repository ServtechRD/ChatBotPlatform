from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import assistant, conversation, websocket, auth, embed
from models.database import Base, engine

# 初始化数据库
Base.metadata.create_all(bind=engine)

app = FastAPI()

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
app.include_router(embed.router)
