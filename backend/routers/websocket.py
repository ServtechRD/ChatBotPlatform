from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from services.llm_service import process_message_through_llm
from models.database import get_db
from models.models import Conversation, Message

router = APIRouter()


# WebSocket连接管理类
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, assistant_uuid: str, customer_id: str):
        await websocket.accept()
        self.active_connections[f"{assistant_uuid}_{customer_id}"] = websocket

    def disconnect(self, assistant_uuid: str, customer_id: str):
        key = f"{assistant_uuid}_{customer_id}"
        if key in self.active_connections:
            del self.active_connections[key]

    async def send_message(self, message: str, assistant_uuid: str, customer_id: str):
        key = f"{assistant_uuid}_{customer_id}"
        websocket = self.active_connections.get(key)
        if websocket:
            await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)


# 实例化WebSocket连接管理类
manager = ConnectionManager()


@router.websocket("/ws/assistant/{assistant_uuid}/{customer_id}")
async def websocket_endpoint(
        websocket: WebSocket,
        assistant_uuid: str,
        customer_id: str,
        db: Session = Depends(get_db)
):
    # 客户连接处理
    await manager.connect(websocket, assistant_uuid, customer_id)

    try:
        # 初始化对话
        conversation = Conversation(assistant_id=assistant_uuid, customer_id=customer_id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        while True:
            # 接收客户的消息
            data = await websocket.receive_text()

            print("recv :"+data)

            # 将收到的消息保存为对话记录
            new_message = Message(
                conversation_id=conversation.conversation_id,
                sender="客户",
                content=data
            )
            db.add(new_message)
            db.commit()
            # 開始思考
            await manager.send_message("@@@", assistant_uuid, customer_id)
            # 使用 LLM 处理消息，生成智能回复
            response = await process_message_through_llm(data, assistant_uuid, customer_id)

            # 保存助理的回复消息
            assistant_reply = Message(
                conversation_id=conversation.conversation_id,
                sender="助理",
                content=response
            )
            db.add(assistant_reply)
            db.commit()
            # 停止思考
            await manager.send_message("###", assistant_uuid, customer_id)
            # 将助理回复发送给客户
            await manager.send_message(response, assistant_uuid, customer_id)

    except WebSocketDisconnect:
        manager.disconnect(assistant_uuid, customer_id)
        print(f"WebSocket断开连接：{assistant_uuid} - {customer_id}")
