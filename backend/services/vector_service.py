from datetime import datetime
from contextlib import asynccontextmanager, contextmanager
import asyncio
import threading

from filelock import FileLock

# from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings # pyright: ignore[reportMissingImports]
from langchain_community.vectorstores import FAISS # pyright: ignore[reportMissingImports]
from langchain_community.document_loaders import TextLoader, PyPDFLoader, Docx2txtLoader # pyright: ignore[reportMissingImports]
from langchain_text_splitters import RecursiveCharacterTextSplitter # pyright: ignore[reportMissingImports]
from langchain_core.documents import Document  # pyright: ignore[reportMissingImports]
from langchain_community.chat_models import ChatOpenAI  # pyright: ignore[reportMissingImports]
from sqlalchemy.orm import Session  # pyright: ignore[reportMissingImports]
from fastapi import UploadFile  # pyright: ignore[reportMissingImports]
from starlette.concurrency import run_in_threadpool
from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
from models.models import KnowledgeBase  # pyright: ignore[reportMissingImports]
from transformers import pipeline  # pyright: ignore[reportMissingImports]
from rake_nltk import Rake  # pyright: ignore[reportMissingImports]
from langchain_core.messages import HumanMessage  # pyright: ignore[reportMissingImports]
import faiss # pyright: ignore[reportMissingImports]
import pickle

import os
import time
import tiktoken  # pyright: ignore[reportMissingImports]
import langid  # pyright: ignore[reportMissingImports]
import uuid
import json
import re

from utils.logger import get_logger

load_dotenv()  # 載入 .env 檔案中的環境變數

logger = get_logger(__name__)

api_key = os.getenv("OPENAI_API_KEY")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "EMPTY")
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://127.0.0.1:8000/v1")
VLLM_MODEL = (os.getenv("VLLM_MODEL") or "Qwen/Qwen2.5-7B-Instruct-AWQ").strip()
VLLM_SUMMARY_MODEL = os.getenv("VLLM_SUMMARY_MODEL", "").strip()

# 用於取得向量儲存（key 一律為 int 型別的 assistant_id）
vector_store = {}
_assistant_vector_write_locks: dict[int, asyncio.Lock] = {}
_faiss_thread_locks: dict[int, threading.RLock] = {}
_faiss_thread_locks_guard = threading.Lock()
FAISS_FILE_LOCK_TIMEOUT = float(os.getenv("FAISS_FILE_LOCK_TIMEOUT", "300"))


def normalize_assistant_id(assistant_id) -> int:
    """WebSocket 路徑參數為 str，上傳 API 為 int；統一為 int 以免快取分裂。"""
    if isinstance(assistant_id, bool):
        raise TypeError("assistant_id must be int or numeric str")
    if isinstance(assistant_id, int):
        return assistant_id
    if isinstance(assistant_id, str):
        s = assistant_id.strip()
        if s.isdigit():
            return int(s)
    raise TypeError(f"Invalid assistant_id: {assistant_id!r}")


def _get_assistant_vector_write_lock(assistant_id: int) -> asyncio.Lock:
    """per-assistant asyncio 寫入鎖；可在 async with 內 await，不會阻塞 event loop。"""
    aid = normalize_assistant_id(assistant_id)
    lock = _assistant_vector_write_locks.get(aid)
    if lock is None:
        lock = asyncio.Lock()
        _assistant_vector_write_locks[aid] = lock
    return lock


@asynccontextmanager
async def assistant_vector_write_lock(assistant_id: int):
    aid = normalize_assistant_id(assistant_id)
    lock = _get_assistant_vector_write_lock(aid)
    logger.info("[向量庫寫入鎖] 等待鎖 assistant_id=%s", aid)
    async with lock:
        logger.info("[向量庫寫入鎖] 取得鎖 assistant_id=%s", aid)
        try:
            yield
        finally:
            logger.info("[向量庫寫入鎖] 釋放鎖 assistant_id=%s", aid)


def _get_faiss_thread_lock(assistant_id: int) -> threading.RLock:
    aid = normalize_assistant_id(assistant_id)
    with _faiss_thread_locks_guard:
        lock = _faiss_thread_locks.get(aid)
        if lock is None:
            lock = threading.RLock()
            _faiss_thread_locks[aid] = lock
        return lock


def _vector_store_file_lock_path(assistant_id: int) -> str:
    aid = normalize_assistant_id(assistant_id)
    return f"./vector_stores/assistant_{aid}.lock"


@contextmanager
def faiss_disk_lock(assistant_id: int):
    """
    per-assistant 執行緒鎖 + 跨 process 檔案鎖，保護 FAISS index 讀寫。
    FAISS index.add / write_index 非 thread-safe，多 worker 時需檔案鎖協調。
    """
    aid = normalize_assistant_id(assistant_id)
    os.makedirs("./vector_stores", exist_ok=True)
    thread_lock = _get_faiss_thread_lock(aid)
    file_lock = FileLock(_vector_store_file_lock_path(aid), timeout=FAISS_FILE_LOCK_TIMEOUT)
    with thread_lock:
        with file_lock:
            yield


def _vector_store_paths(assistant_id: int) -> tuple[str, str]:
    aid = normalize_assistant_id(assistant_id)
    base = f"./vector_stores/assistant_{aid}"
    return f"{base}.index", f"{base}_metadata.pkl"


def disk_vector_store_exists(assistant_id) -> bool:
    index_path, metadata_path = _vector_store_paths(assistant_id)
    return os.path.exists(index_path) and os.path.exists(metadata_path)


def invalidate_vector_store_cache(assistant_id) -> None:
    """清除記憶體快取（含歷史 str key），避免上傳後對話仍讀到舊向量。"""
    aid = normalize_assistant_id(assistant_id)
    vector_store.pop(aid, None)
    vector_store.pop(str(aid), None)


def set_vector_store_cache(assistant_id, store) -> None:
    """寫入快取前清除同助理的 int/str 雙 key 殘留。"""
    aid = normalize_assistant_id(assistant_id)
    invalidate_vector_store_cache(aid)
    if store is not None:
        vector_store[aid] = store


def clear_vector_store_files(assistant_id) -> None:
    """刪除磁碟上的 FAISS 索引（例如助理刪除後 ID 重用、或 DB 與磁碟不一致）。"""
    aid = normalize_assistant_id(assistant_id)
    index_path, metadata_path = _vector_store_paths(aid)
    invalidate_vector_store_cache(aid)
    with faiss_disk_lock(aid):
        for path in (index_path, metadata_path):
            if os.path.isfile(path):
                try:
                    os.remove(path)
                    logger.info("[向量庫] 已刪除殘留檔案 path=%s", path)
                except OSError as e:
                    logger.warning("[向量庫] 刪除檔案失敗 path=%s error=%s", path, e)

# 預熱 SentenceTransformer / BGE Embeddings（避免第一次 RAG 卡住造成連帶的 TTS 504）
BGE_EMBEDDINGS_MODEL_NAME = "BAAI/bge-base-zh-v1.5"
_bge_embeddings = None


def prewarm_bge_embeddings():
    """
    ??server ??敺????臬銵?頛 bge-base-zh-v1.5 embeddings嚗?
    雿輻洵銝甈∠?唳?銝??◤ SentenceTransformer 銝?/???雿?
    """
    global _bge_embeddings
    if _bge_embeddings is not None:
        return _bge_embeddings
    logger.info("[Prewarm][BGE] Loading HuggingFaceEmbeddings: %s", BGE_EMBEDDINGS_MODEL_NAME)
    embeddings = HuggingFaceEmbeddings(model_name=BGE_EMBEDDINGS_MODEL_NAME)
    # embed_query 會觸發 model/weights 的實際載入與 warmup
    _ = embeddings.embed_query("預熱")
    _bge_embeddings = embeddings
    logger.info("[Prewarm][BGE] Embeddings ready.")
    return _bge_embeddings

# 載入預訓練的摘要產生模型（明確指定 model，避免 transformers 啟動警告）
summarizer = pipeline(
    "summarization",
    model="sshleifer/distilbart-cnn-12-6",
)


def generate_doc_id():
    """
    ?Ｙ??臭???隞?ID
    """
    return str(uuid.uuid4())


def process_documents_with_id(documents):
    """
    ?箸?隞賣?隞嗥?銝??doc_id
    """
    for doc in documents:
        doc.metadata["doc_id"] = generate_doc_id()  # 將 doc_id 寫入 metadata
    return documents


def generate_summary_and_keywords(text, max_summary_words=150, max_keywords=10):
    """
    Generate summary and keywords with AGGRESSIVE truncation (First 500 chars).
    """
    
    # 1. 語言設定
    LANGUAGE_MAP = {
        "en": "English",
        "fr": "French",
        "es": "Spanish",
        "de": "German",
        "zh-cn": "Simplified Chinese",
        "zh-tw": "Traditional Chinese",
        "zh": "Traditional Chinese",
    }
    lang_code, _ = langid.classify(text)
    target_language = LANGUAGE_MAP.get(lang_code, "Traditional Chinese")
    
    if "Chinese" in target_language:
        target_language = "Traditional Chinese (Taiwan)"

    logger.info(f"Generating summary. Target Output Lang = {target_language}")

    # 2. ⚠️ 關鍵修正：極限縮減至前 500 字 ⚠️
    # 這能確保 Prompt 絕對完整，徹底杜絕幻覺與亂碼
    SAFE_TEXT_LIMIT = 500 
    truncated_text = text[:SAFE_TEXT_LIMIT]

    system_instruction = (
        f"You are a professional summarizer API. "
        f"Your task is to analyze the text and return a valid JSON response in {target_language}. "
        f"NO explaining, NO chatting, just raw JSON."
    )

    # 3. 三明治提示法 (Sandwich Prompt)
    user_prompt = (
        f"### INSTRUCTIONS ###\n"
        # f"1. **Language**: Output MUST be in {target_language}.\n"
        f"#zh_tw 1. **Language**: Output MUST be in Traditional Chinese (Taiwan).\n"
        f"2. **Summary**: Summarize the text in under {max_summary_words} words based on the provided snippet.\n"
        f"3. **Keywords**: Extract 3-5 keywords.\n"
        f"4. **Format**: Return ONLY a JSON object with keys 'summary' and 'keywords'.\n\n"
        f"### INPUT TEXT (Truncated) ###\n"
        f"{truncated_text}\n\n"
        f"### REMINDER ###\n"
        f"Please output valid JSON only. "
        f"Example: {{\"summary\": \"摘要內容...\", \"keywords\": [\"k1\", \"k2\"]}}"
    )

    # 4. 初始化 LLM (啟用 JSON 模式)
    runtime_model = VLLM_SUMMARY_MODEL or VLLM_MODEL or "gpt-oss:20b"
    llm = ChatOpenAI(
        openai_api_key=VLLM_API_KEY,
        base_url=VLLM_BASE_URL,
        model=runtime_model,
        temperature=0.1,
        model_kwargs={},
    )
    
    try:
        from langchain_core.messages import SystemMessage, HumanMessage
        
        response = llm.invoke([
            SystemMessage(content=system_instruction),
            HumanMessage(content=user_prompt)
        ])
        
        result_text = response.content.strip()
        logger.info(f"LLM Raw Output (len={len(result_text)}): {result_text[:100]}...")
        
        # 5. 解析 JSON
        summary = ""
        keywords_line = ""

        try:
            clean_json = result_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            
            summary = data.get("summary", "")
            keywords = data.get("keywords", [])
            
            if isinstance(keywords, list):
                keywords_line = ", ".join([str(k) for k in keywords])
            else:
                keywords_line = str(keywords)

        except json.JSONDecodeError:
            logger.warning("JSON parsing failed, attempting regex fallback.")
            sum_match = re.search(r'"summary"\s*:\s*"(.*?)"', result_text, re.DOTALL)
            key_match = re.search(r'"keywords"\s*:\s*\[(.*?)\]', result_text, re.DOTALL)
            
            if sum_match:
                summary = sum_match.group(1)
            if key_match:
                keywords_line = key_match.group(1).replace('"', '').replace("'", "")
            
            if not summary:
                 summary = result_text[:max_summary_words]

        return summary.strip(), keywords_line.strip()

    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        return "Summary generation unavailable", ""

# 計算文件的 token 數量
def calculate_token_count(documents):
    tokenizer = tiktoken.get_encoding("cl100k_base")  # 依模型選擇編碼
    token_count = 0
    for doc in documents:
        token_count += len(tokenizer.encode(doc.page_content))
    return token_count


# 用於儲存向量資料庫
def _write_vector_store_to_disk(assistant_id: int, faiss_store) -> None:
    aid = normalize_assistant_id(assistant_id)
    save_path, metadata_path = _vector_store_paths(aid)
    if not os.path.exists("./vector_stores"):
        os.makedirs("./vector_stores")
    faiss.write_index(faiss_store.index, save_path)
    with open(metadata_path, "wb") as f:
        metadata = {
            "docstore": faiss_store.docstore,
            "index_to_docstore_id": faiss_store.index_to_docstore_id,
        }
        pickle.dump(metadata, f)


def save_vector_store(assistant_id: int, faiss_store):
    aid = normalize_assistant_id(assistant_id)
    with faiss_disk_lock(aid):
        _write_vector_store_to_disk(aid, faiss_store)


def _read_vector_store_from_disk(assistant_id: int):
    aid = normalize_assistant_id(assistant_id)
    load_path, metadata_path = _vector_store_paths(aid)
    index = faiss.read_index(load_path)
    embeddings = _bge_embeddings or HuggingFaceEmbeddings(
        model_name=BGE_EMBEDDINGS_MODEL_NAME
    )
    with open(metadata_path, "rb") as f:
        metadata = pickle.load(f)
        docstore = metadata["docstore"]
        index_to_docstore_id = metadata["index_to_docstore_id"]
    return FAISS(
        index=index,
        docstore=docstore,
        index_to_docstore_id=index_to_docstore_id,
        embedding_function=embeddings,
    )


def load_vector_store(assistant_id: int):
    aid = normalize_assistant_id(assistant_id)
    load_path, metadata_path = _vector_store_paths(aid)

    if os.path.exists(load_path) and os.path.exists(metadata_path):
        with faiss_disk_lock(aid):
            loaded = _read_vector_store_from_disk(aid)
            vector_store[aid] = loaded
            return loaded
    else:
        # 傳回空的 FAISS 物件
        return None
        #embeddings = OpenAIEmbeddings()
        #return FAISS.from_texts([], embeddings)  # 空的文字列表
        #raise ValueError(f"Vector store for assistant {assistant_id} is not initialized.")


# 依檔案類型選擇載入器
def get_loader(file_path: str, file_type: str):
    if file_type == "pdf":
        return PyPDFLoader(file_path)
    elif file_type == "docx":
        return Docx2txtLoader(file_path)
    elif file_type == "txt":
        return TextLoader(file_path)
    else:
        raise ValueError("Unsupported file type")


def _process_and_store_file_heavy_sync(
    assistant_id: int,
    file_location: str,
    filename: str,
    file_extension: str,
    vs,  # FAISS vector store or None
):
    """
    ?典銵?瘙葉?瑁???甇仿??摩嚗??交?獢?憛??乓神?亙??澈??蝣??閬?
    DB 撖怠?勗?急?其蜓?瑁?蝺銵?
    """
    t_start = time.perf_counter()
    try:
        loader = get_loader(file_location, file_extension)
        t_load = time.perf_counter()
        documents = loader.load()
        if not documents:
            logger.warning("[上傳檔案] 載入後無檔案內容 path=%s ext=%s", file_location, file_extension)
        t_load_s = time.perf_counter() - t_load
        logger.info("[上傳檔案] loader.load 完成 doc_count=%d (耗時=%.3f s)", len(documents), t_load_s)

        t_split = time.perf_counter()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=300,
            chunk_overlap=50,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""]
        )
        documents = text_splitter.split_documents(documents)
        documents = process_documents_with_id(documents)
        logger.info("[上傳檔案] 切chunk完成 chunks=%d (耗時=%.3f s)", len(documents), time.perf_counter() - t_split)

        embeddings = _bge_embeddings or HuggingFaceEmbeddings(
            model_name=BGE_EMBEDDINGS_MODEL_NAME
        )
        t_faiss = time.perf_counter()
        with faiss_disk_lock(assistant_id):
            if vs:
                test_emb = embeddings.embed_query("test")
                if len(test_emb) != vs.index.d:
                    raise ValueError(
                        f"Vector store dimension mismatch (Index: {vs.index.d}, Model: {len(test_emb)}). "
                        "Please reset knowledge base for this assistant."
                    )
                doc_ids = [doc.metadata["doc_id"] for doc in documents]
                vs.add_documents(documents, ids=doc_ids)
                vector_store[normalize_assistant_id(assistant_id)] = vs
            else:
                doc_ids = [doc.metadata["doc_id"] for doc in documents]
                aid = normalize_assistant_id(assistant_id)
                vector_store[aid] = FAISS.from_documents(documents, embeddings, ids=doc_ids)
                vs = vector_store[aid]

            _write_vector_store_to_disk(assistant_id, vs)
        logger.info("[上傳檔案] FAISS embedding+寫入完成 chunks=%d (耗時=%.3f s)", len(documents), time.perf_counter() - t_faiss)

        token_count = calculate_token_count(documents)
        full_text = " ".join([doc.page_content for doc in documents])
        t_llm = time.perf_counter()
        summary, keyword_lines = generate_summary_and_keywords(full_text)
        logger.info("[上傳檔案] LLM摘要完成 (耗時=%.3f s)", time.perf_counter() - t_llm)
        doc_ids_string = ", ".join(doc_ids)

        t_total_s = time.perf_counter() - t_start
        logger.info(
            "[銝瑼? ??頛臬?? assistant_id=%s filename=%s chunks=%d token_count=%d ??=%.3f s",
            assistant_id, filename, len(documents), token_count, t_total_s
        )
        return {
            "doc_ids": doc_ids,
            "doc_ids_string": doc_ids_string,
            "summary": summary,
            "keyword_lines": keyword_lines,
            "token_count": token_count,
            "file_extension": file_extension,
        }
    except Exception as e:
        logger.exception("[上傳檔案] _process_and_store_file_heavy_sync 失敗 filename=%s error=%s", filename, e)
        raise


def _update_knowledge_base_heavy_sync(
    assistant_id: int,
    new_file_path: str,
    new_filename: str,
    new_content: str,
    old_doc_ids: list[str],
    vs,
):
    """執行緒池執行：更新知識庫的 embedding / FAISS / 摘要（與上傳 heavy 路徑一致）。"""
    loader = TextLoader(new_file_path, encoding="utf-8")
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""],
    )
    documents = text_splitter.split_documents(documents)
    documents = process_documents_with_id(documents)

    embeddings = _bge_embeddings or HuggingFaceEmbeddings(
        model_name=BGE_EMBEDDINGS_MODEL_NAME
    )
    aid = normalize_assistant_id(assistant_id)

    with faiss_disk_lock(aid):
        if vs and old_doc_ids:
            try:
                logger.info("Attempting to delete old vectors: %s", old_doc_ids)
                vs.delete(old_doc_ids)
            except Exception as e:
                logger.warning("Could not delete old vectors (continuing anyway): %s", e)

        if vs:
            test_emb = embeddings.embed_query("test")
            if len(test_emb) != vs.index.d:
                raise ValueError(
                    f"Vector store dimension mismatch (Index: {vs.index.d}, Model: {len(test_emb)}). "
                    "Please reset knowledge base for this assistant."
                )
            doc_ids = [doc.metadata["doc_id"] for doc in documents]
            vs.add_documents(documents, ids=doc_ids)
        else:
            doc_ids = [doc.metadata["doc_id"] for doc in documents]
            vector_store[aid] = FAISS.from_documents(documents, embeddings, ids=doc_ids)
            vs = vector_store[aid]

        _write_vector_store_to_disk(assistant_id, vs)

    token_count = calculate_token_count(documents)
    summary, keyword_lines = generate_summary_and_keywords(new_content)
    new_doc_ids = [doc.metadata["doc_id"] for doc in documents]

    return {
        "vs": vs,
        "doc_ids_string": ", ".join(new_doc_ids),
        "summary": summary,
        "keyword_lines": keyword_lines,
        "token_count": token_count,
    }


# 處理並儲存檔案嵌入至向量資料庫
async def process_and_store_file(assistant_id: int, file: UploadFile, db: Session):
    t_start = time.perf_counter()
    filename = file.filename or "(unnamed)"
    logger.info(
        "[銝瑼? ??] assistant_id=%s filename=%s content_type=%s",
        assistant_id, filename, getattr(file, "content_type", None)
    )

    try:
        aid = normalize_assistant_id(assistant_id)
        async with assistant_vector_write_lock(aid):
            # 輕量步驟留在主執行緒：查詢 DB 與向量庫
            t_q = time.perf_counter()
            existing_entry = db.query(KnowledgeBase).filter(
                KnowledgeBase.assistant_id == aid,
                KnowledgeBase.file_name == filename
            ).first()
            kb_count = db.query(KnowledgeBase).filter(
                KnowledgeBase.assistant_id == aid
            ).count()
            if kb_count == 0 and disk_vector_store_exists(aid):
                logger.warning(
                    "[銝瑼?] 蝤??????澈雿?DB ?∠霅澈蝝???航?箏?文? ID ?嚗?撠???assistant_id=%s",
                    aid,
                )
                clear_vector_store_files(aid)
                vs = None
            else:
                vs = get_vector_store(aid)
            t_q_s = time.perf_counter() - t_q
            logger.info(
                "[銝瑼?] ?亥岷?Ｘ??亥?摨怨???摨?摰? existing=%s vs_exists=%s (??=%.3f s)",
                existing_entry is not None, vs is not None, t_q_s
            )

            if existing_entry and vs:
                old_doc_ids = [did.strip() for did in (existing_entry.doc_ids or "").split(",") if did.strip()]
                if old_doc_ids:
                    try:
                        with faiss_disk_lock(aid):
                            if hasattr(vs, 'index_to_docstore_id'):
                                current_doc_ids = set(vs.index_to_docstore_id.values())
                                ids_to_delete = [did for did in old_doc_ids if did in current_doc_ids]
                            else:
                                ids_to_delete = old_doc_ids

                            if ids_to_delete:
                                vs.delete(ids_to_delete)
                                logger.info("[上傳檔案] 刪除舊向量 完成 filename=%s removed_count=%d (original_db_count=%d)",
                                            filename, len(ids_to_delete), len(old_doc_ids))
                            else:
                                logger.info("[上傳檔案] 無舊向量需刪除 (舊 ID 不存在於向量庫，可能是庫已重置) filename=%s", filename)

                    except Exception as e:
                        logger.warning("[上傳檔案] 刪除舊向量失敗（非致命，繼續上傳） filename=%s error=%s", filename, e)

            save_directory = f"./uploaded_files/assistant_{aid}"
            os.makedirs(save_directory, exist_ok=True)
            file_location = os.path.join(save_directory, filename)

            t_read = time.perf_counter()
            content = await file.read()
            file_size = len(content)
            logger.info("[上傳檔案] 讀取上傳內容 完成 size=%d bytes (耗時=%.3f s)", file_size, time.perf_counter() - t_read)

            with open(file_location, "wb+") as f:
                f.write(content)
            logger.info("[上傳檔案] 寫入磁碟 完成 path=%s", file_location)

            file_extension = filename.split(".")[-1].lower() if "." in filename else ""
            if not file_extension:
                raise ValueError("File must have an extension")

            from services.rag_queue import enqueue_rag
            t_heavy = time.perf_counter()
            heavy_result = await enqueue_rag(
                _process_and_store_file_heavy_sync,
                aid,
                file_location,
                filename,
                file_extension,
                vs,
            )
            logger.info("[上傳檔案] enqueue_rag完成 (耗時=%.3f s)", time.perf_counter() - t_heavy)

            doc_ids_string = heavy_result["doc_ids_string"]
            summary = heavy_result["summary"]
            keyword_lines = heavy_result["keyword_lines"]
            token_count = heavy_result["token_count"]
            file_extension = heavy_result["file_extension"]

            MAX_SUMMARY_LEN = 10000
            MAX_KEYWORDS_LEN = 1000

            if len(summary) > MAX_SUMMARY_LEN:
                 logger.warning("[上傳檔案] Summary 過長 (%d chars)，進行截斷。", len(summary))
                 summary = summary[:MAX_SUMMARY_LEN] + "...(truncated)"

            if len(keyword_lines) > MAX_KEYWORDS_LEN:
                 logger.warning("[上傳檔案] Keywords 過長 (%d chars)，進行截斷。", len(keyword_lines))
                 keyword_lines = keyword_lines[:MAX_KEYWORDS_LEN]

            t_db = time.perf_counter()
            if existing_entry:
                logger.info("[上傳檔案] 更新既有 DB 紀錄 filename=%s", filename)
                existing_entry.summary = summary
                existing_entry.keywords = keyword_lines
                existing_entry.doc_ids = doc_ids_string
                existing_entry.token_count = token_count
                existing_entry.upload_date = datetime.utcnow()
                db.commit()
                db.refresh(existing_entry)
                entry_to_return = existing_entry
            else:
                logger.info("[上傳檔案] 新增 DB 紀錄 filename=%s", filename)
                new_entry = KnowledgeBase(
                    assistant_id=aid,
                    file_name=filename,
                    file_type=f"{file_extension.upper()}",
                    summary=summary,
                    keywords=keyword_lines,
                    doc_ids=doc_ids_string,
                    description=f"Uploaded file {filename} by assistant {assistant_id}",
                    token_count=token_count,
                    upload_date=datetime.utcnow()
                )
                db.add(new_entry)
                db.commit()
                db.refresh(new_entry)
                entry_to_return = new_entry
            logger.info("[上傳檔案] DB寫入完成 (耗時=%.3f s)", time.perf_counter() - t_db)

            set_vector_store_cache(aid, vector_store.get(aid))
            vs = vector_store.get(aid)
            t_total_s = time.perf_counter() - t_start
            logger.info(
                "[上傳檔案] 全流程完成 assistant_id=%s filename=%s token_count=%d 總耗時=%.3f s",
                aid, filename, token_count, t_total_s
            )
            return {
                "vector_store": vs,
                "km": {
                    "file_name": entry_to_return.file_name,
                    "description": entry_to_return.description,
                    "token_count": entry_to_return.token_count,
                    "file_type": entry_to_return.file_type,
                    "summary": entry_to_return.summary,
                    "keywords": entry_to_return.keywords,
                    "doc_ids": entry_to_return.doc_ids,
                    "upload_date": entry_to_return.upload_date
                }
            }

    except Exception as e:
        t_total_s = time.perf_counter() - t_start
        logger.exception(
            "[銝瑼? 憭望?] assistant_id=%s filename=%s 蝮質?=%.3f s error=%s",
            assistant_id, filename, t_total_s, e
        )
        raise


def get_vector_store_status(assistant_id: int):
    """
    ?????脣?????蝯梯?鞈?
    """
    vs = get_vector_store(assistant_id)
    if not vs:
        return {
            "status": "not_initialized",
            "message": "Vector store not found for this assistant"
        }
    
    # FAISS index info
    index = vs.index
    doc_count = index.ntotal
    dimension = index.d
    
    # List files from metadata
    filenames = set()
    sample_docs = []
    
    # Get all doc IDs and metadata
    try:
        # LangChain FAISS stores docs in docstore
        for doc_id, doc in vs.docstore._dict.items():
            fname = doc.metadata.get("file_name") or os.path.basename(doc.metadata.get("source", "unknown"))
            filenames.add(fname)
            if len(sample_docs) < 5:
                sample_docs.append({
                    "id": doc_id,
                    "file": fname,
                    "content_preview": doc.page_content[:100] + "..."
                })
    except Exception as e:
        logger.error(f"Error reading docstore metadata: {e}")

    return {
        "status": "ready",
        "assistant_id": assistant_id,
        "total_documents": doc_count,
        "dimension": dimension,
        "files_indexed": list(filenames),
        "sample_documents": sample_docs
    }


def list_knowledge(assistant_id: int, db: Session):
    records = db.query(KnowledgeBase).filter(KnowledgeBase.assistant_id == assistant_id).order_by(
        KnowledgeBase.upload_date.desc()).all()
    return [
        {
            "id": record.id,
            "file_name": record.file_name,
            "description": record.description,
            "token_count": record.token_count,
            "file_type": record.file_type,
            "summary": record.summary,
            "keywords": record.keywords,
            "doc_ids": record.doc_ids,
            "upload_date": record.upload_date
        }
        for record in records
    ]


def get_vector_store(assistant_id):
    aid = normalize_assistant_id(assistant_id)
    # 相容舊版以 str 為 key 的快取，遷移後刪除
    stale = vector_store.pop(str(aid), None)
    if stale is not None and aid not in vector_store:
        vector_store[aid] = stale
        logger.info("[向量庫] 已將 str key 快取遷移為 int assistant_id=%s", aid)
    if aid not in vector_store:
        return load_vector_store(aid)
    return vector_store[aid]


def get_knowledge_content(assistant_id: int, knowledge_id: int, db: Session):
    record = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_id,
                                            KnowledgeBase.assistant_id == assistant_id).first()
    if not record:
        raise ValueError("Knowledge base item not found")

    # Check if file is editable (only text files can be edited)
    file_ext = os.path.splitext(record.file_name)[1].lower()
    if file_ext not in ['.txt']:
        raise ValueError(f"Only text files (.txt) can be edited. This file is {file_ext}")
    
    save_directory = f"./uploaded_files/assistant_{assistant_id}"
    file_path = os.path.join(save_directory, record.file_name)

    if not os.path.exists(file_path):
        raise ValueError(f"File not found: {file_path}")

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


async def delete_knowledge_base_item(assistant_id: int, knowledge_id: int, db: Session):
    """
    靘?knowledge_base.id ?芷銝蝑霅???FAISS 蝘駁撠? doc_ids??支??單?獢??DB ??
    """
    aid = normalize_assistant_id(assistant_id)
    async with assistant_vector_write_lock(aid):
        record = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == knowledge_id,
            KnowledgeBase.assistant_id == assistant_id,
        ).first()
        if not record:
            raise ValueError("Knowledge base item not found")

        file_name = record.file_name
        vs = get_vector_store(assistant_id)
        old_doc_ids = [did.strip() for did in record.doc_ids.split(",") if did.strip()]
        if vs and old_doc_ids:
            try:
                logger.info(
                    "Deleting vectors for knowledge_id=%s doc_count=%d",
                    knowledge_id,
                    len(old_doc_ids),
                )
                with faiss_disk_lock(aid):
                    vs.delete(old_doc_ids)
                    _write_vector_store_to_disk(assistant_id, vs)
                set_vector_store_cache(assistant_id, vs)
            except Exception as e:
                logger.warning("Could not delete vectors (continuing DB/file delete): %s", e)
        elif vs and not old_doc_ids:
            logger.info("No doc_ids on record knowledge_id=%s, skipping vector delete", knowledge_id)

        save_directory = f"./uploaded_files/assistant_{aid}"
        file_path = os.path.join(save_directory, file_name)
        if os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError as e:
                logger.warning("Could not remove file %s: %s", file_path, e)

        db.delete(record)
        db.commit()

        return {
            "id": knowledge_id,
            "assistant_id": assistant_id,
            "file_name": file_name,
        }


async def update_knowledge_base_item(assistant_id: int, knowledge_id: int, new_content: str, db: Session):
    aid = normalize_assistant_id(assistant_id)
    async with assistant_vector_write_lock(aid):
        # 1. Find record
        record = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_id,
                                                KnowledgeBase.assistant_id == assistant_id).first()
        if not record:
            raise ValueError("Knowledge base item not found")

        # 2. Get Vector Store
        vs = get_vector_store(assistant_id)
        old_doc_ids = [did.strip() for did in record.doc_ids.split(",") if did.strip()]

        # 3. Overwrite existing file
        save_directory = f"./uploaded_files/assistant_{assistant_id}"
        if not os.path.exists(save_directory):
            os.makedirs(save_directory)

        new_filename = record.file_name
        new_file_path = os.path.join(save_directory, new_filename)

        logger.info(f"Overwriting file: {new_file_path}")
        with open(new_file_path, "w", encoding="utf-8") as f:
            f.write(new_content)

        from services.rag_queue import enqueue_rag
        heavy_result = await enqueue_rag(
            _update_knowledge_base_heavy_sync,
            aid,
            new_file_path,
            new_filename,
            new_content,
            old_doc_ids,
            vs,
        )

        set_vector_store_cache(assistant_id, heavy_result["vs"])

        record.summary = heavy_result["summary"]
        record.keywords = heavy_result["keyword_lines"]
        record.doc_ids = heavy_result["doc_ids_string"]
        record.token_count = heavy_result["token_count"]
        record.upload_date = datetime.utcnow()
        
        db.commit()
        db.refresh(record)

        return {
            "id": record.id,
            "file_name": record.file_name,
            "summary": record.summary,
            "keywords": record.keywords,
            "doc_ids": record.doc_ids,
            "token_count": record.token_count,
            "upload_date": record.upload_date
        }


