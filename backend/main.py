from pathlib import Path

from dotenv import load_dotenv
# 必須在 import routers/tts 前先載入，因為部分模組在 import 時就會呼叫 os.getenv.
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir / ".env", override=False)

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import assistant, conversation, websocket, auth, embed, mfa, tts
from models.database import Base, engine
from services.assistant_prompt_storage import ensure_description_use_file_column
from middleware.request_audit import RequestAuditMiddleware
from utils.logger import setup_logging, get_logger

# 日誌：寫入 ./log/（依日期與大小切檔，見 utils.logger）
setup_logging()
logger = get_logger(__name__)

# 初始化資料庫
Base.metadata.create_all(bind=engine)
ensure_description_use_file_column(engine)

app = FastAPI()


@app.on_event("startup")
def startup_event():
    logger.info("Application started.")

    # 預熱 RAG embeddings，避免第一次請求時模型下載/初始化卡住造成連帶 TTS 504
    try:
        from services.vector_service import prewarm_bge_embeddings

        prewarm_bge_embeddings()
    except Exception as e:
        logger.warning("Prewarm BGE embeddings failed (continuing): %s", e)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.add_middleware(RequestAuditMiddleware)

# 配置靜態檔案：/public 與 /images（相容舊連結 /images/xxx.jpg）
_backend_root = Path(__file__).resolve().parent
_public_dir = _backend_root / "public"
_images_dir = _public_dir / "images"
_videos_dir = _public_dir / "videos"
for _d in (_public_dir, _images_dir, _videos_dir):
    _d.mkdir(parents=True, exist_ok=True)

app.mount("/public", StaticFiles(directory=str(_public_dir)), name="public")
app.mount("/images", StaticFiles(directory=str(_images_dir)), name="images")
app.mount("/videos", StaticFiles(directory=str(_videos_dir)), name="videos")
# 包含助理、對話、WebSocket 路由
app.include_router(assistant.router)
app.include_router(conversation.router)
app.include_router(websocket.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(mfa.router, prefix="/auth/mfa")
app.include_router(embed.router)
app.include_router(tts.router)
