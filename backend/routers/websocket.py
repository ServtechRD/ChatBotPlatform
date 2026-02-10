import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from services.llm_service import process_message_through_llm
from models.database import get_db
from models.models import Conversation, Message, AIAssistant
from utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


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

setting = {}


def read_json_file(file_path: str) -> dict:
    try:
        with open(file_path, "r", encoding="utf-8") as json_file:
            data = json.load(json_file)
        return data
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.warning("read_json_file failed: path=%s error=%s", file_path, e)
        return None


@router.websocket("/ws/assistant/{assistant_uuid}/{customer_id}")
async def websocket_endpoint(
        websocket: WebSocket,
        assistant_uuid: str,
        customer_id: str,
        db: Session = Depends(get_db)
):
    global setting

    if len(setting) == 0:
        logger.info("Loading config: ./config/setting.json")
        setting = read_json_file("./config/setting.json")

    t_setting_start = time.perf_counter()
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == assistant_uuid).first()
    if not assistant:
        logger.warning("WebSocket rejected: assistant not found, assistant_uuid=%s", assistant_uuid)
        await websocket.close(code=4404)
        return
    model = setting.get("model", "")
    prompt1 = setting.get("prompt1", "")
    prompt2 = setting.get("prompt2", "")
    welcome = assistant.message_welcome
    noidea = assistant.message_noidea
    lang = assistant.language
    t_setting_ms = (time.perf_counter() - t_setting_start) * 1000
    logger.info(
        "WebSocket session: assistant_uuid=%s customer_id=%s model=%s lang=%s (查詢助理與設定耗時=%.2f ms)",
        assistant_uuid, customer_id, model, lang, t_setting_ms
    )

    await manager.connect(websocket, assistant_uuid, customer_id)

    try:
        t_conv_start = time.perf_counter()
        conversation = Conversation(assistant_id=assistant_uuid, customer_id=customer_id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        t_conv_ms = (time.perf_counter() - t_conv_start) * 1000
        logger.info(
            "Conversation created: conversation_id=%s (耗時=%.2f ms)",
            conversation.conversation_id, t_conv_ms
        )

        while True:
            t_recv_start = time.perf_counter()
            data = await websocket.receive_text()
            t_recv_ms = (time.perf_counter() - t_recv_start) * 1000
            logger.info(
                "[收到對話] assistant_uuid=%s customer_id=%s conversation_id=%s 內容長度=%d (接收耗時=%.2f ms)",
                assistant_uuid, customer_id, conversation.conversation_id, len(data or ""), t_recv_ms
            )
            logger.debug("[收到對話] 原始內容: %s", (data or "")[:500])

            t_indicator_start = time.perf_counter()
            await manager.send_message("@@@", assistant_uuid, customer_id)
            await asyncio.sleep(0.1)
            t_indicator_ms = (time.perf_counter() - t_indicator_start) * 1000
            logger.debug("已發送思考中指標 @@@ (耗時=%.2f ms)", t_indicator_ms)

            t_save_user_start = time.perf_counter()
            new_message = Message(
                conversation_id=conversation.conversation_id,
                sender="客户",
                content=data
            )
            db.add(new_message)
            db.commit()
            t_save_user_ms = (time.perf_counter() - t_save_user_start) * 1000
            logger.info("已寫入用戶訊息至 DB (耗時=%.2f ms)", t_save_user_ms)

            t_llm_start = time.perf_counter()
            response = await process_message_through_llm(
                data, assistant_uuid, customer_id, lang, model, prompt1,
                prompt2, welcome, noidea
            )
            t_llm_ms = (time.perf_counter() - t_llm_start) * 1000
            logger.info(
                "[LLM 完成] assistant_uuid=%s 回覆長度=%d (LLM 總耗時=%.2f ms)",
                assistant_uuid, len(response or ""), t_llm_ms
            )
            logger.debug("[LLM 回覆預覽] %s", (response or "")[:300])

            t_save_assistant_start = time.perf_counter()
            assistant_reply = Message(
                conversation_id=conversation.conversation_id,
                sender="助理",
                content=response
            )
            db.add(assistant_reply)
            db.commit()
            t_save_assistant_ms = (time.perf_counter() - t_save_assistant_start) * 1000
            logger.info("已寫入助理回覆至 DB (耗時=%.2f ms)", t_save_assistant_ms)

            t_send_start = time.perf_counter()
            await manager.send_message("###", assistant_uuid, customer_id)
            await asyncio.sleep(0.1)
            await manager.send_message(response, assistant_uuid, customer_id)
            t_send_ms = (time.perf_counter() - t_send_start) * 1000
            logger.info(
                "[對話回合完成] conversation_id=%s 總耗時=%.2f ms (接收=%.2f 存用戶=%.2f LLM=%.2f 存助理=%.2f 回傳=%.2f)",
                conversation.conversation_id,
                t_recv_ms + t_save_user_ms + t_llm_ms + t_save_assistant_ms + t_send_ms,
                t_recv_ms, t_save_user_ms, t_llm_ms, t_save_assistant_ms, t_send_ms
            )

    except WebSocketDisconnect:
        manager.disconnect(assistant_uuid, customer_id)
        logger.info("WebSocket 斷線: assistant_uuid=%s customer_id=%s", assistant_uuid, customer_id)
    except Exception as e:
        manager.disconnect(assistant_uuid, customer_id)
        logger.exception("WebSocket 處理對話時發生錯誤: assistant_uuid=%s customer_id=%s error=%s", assistant_uuid, customer_id, e)
