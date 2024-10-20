from fastapi import FastAPI
from routers import assistant, conversation, websocket,auth
from models.database import Base, engine

# 初始化数据库
Base.metadata.create_all(bind=engine)

app = FastAPI()

# 包含助理、对话、WebSocket路由
app.include_router(assistant.router)
app.include_router(conversation.router)
app.include_router(websocket.router)
app.include_router(auth.router, prefix="/auth")