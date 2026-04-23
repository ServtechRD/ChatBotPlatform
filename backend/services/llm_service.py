from langchain.chat_models import ChatOpenAI  # pyright: ignore[reportMissingImports]
from langchain_core.messages import HumanMessage  # pyright: ignore[reportMissingImports]
from services.vector_service import get_vector_store

from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
import os
import time
import math
import re

from utils.logger import get_logger
from typing import List, Optional, Dict, Any

import asyncio
from concurrent.futures import ThreadPoolExecutor

# Create a thread pool for LLM operations
executor = ThreadPoolExecutor(max_workers=10)

load_dotenv()  # 載入 .env 檔案中的環境變數

api_key = os.getenv("OPENAI_API_KEY")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "EMPTY")
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL")
VLLM_MODEL = os.getenv("VLLM_MODEL").strip()

logger = get_logger(__name__)


def _tokenize_for_bm25(text: str) -> List[str]:
    """簡單中文/英文混合 tokenizer，供 BM25 使用。"""
    raw = (text or "").lower()
    return re.findall(r"[\u4e00-\u9fff]|[a-z0-9_]+", raw)


def _bm25_score(query_tokens: List[str], doc_tokens: List[str], idf: Dict[str, float], avgdl: float, *, k1: float = 1.5, b: float = 0.75) -> float:
    """純 Python BM25 分數計算，避免額外依賴。"""
    if not query_tokens or not doc_tokens:
        return 0.0

    tf: Dict[str, int] = {}
    for tok in doc_tokens:
        tf[tok] = tf.get(tok, 0) + 1

    dl = max(1, len(doc_tokens))
    score = 0.0
    for q in query_tokens:
        freq = tf.get(q, 0)
        if freq <= 0:
            continue
        denom = freq + k1 * (1.0 - b + b * dl / max(1e-9, avgdl))
        score += idf.get(q, 0.0) * (freq * (k1 + 1.0)) / max(1e-9, denom)
    return score


def _doc_key(doc) -> str:
    """嘗試用 metadata.doc_id 當唯一鍵，fallback 用內容 hash。"""
    md = getattr(doc, "metadata", {}) or {}
    did = md.get("doc_id")
    if did:
        return str(did)
    return str(hash(((doc.page_content or "")[:500], tuple(sorted(md.items())))))


def _hybrid_retrieve(vector_store, query: str) -> List[Any]:
    """
    向量 + BM25 混合檢索，回傳依混合分數排序的文件列表。
    """
    top_k = max(1, int(os.getenv("RAG_TOP_K", "5")))
    vector_fetch_k = max(top_k, int(os.getenv("RAG_VECTOR_FETCH_K", "20")))
    bm25_corpus_limit = max(vector_fetch_k, int(os.getenv("RAG_BM25_CORPUS_LIMIT", "1500")))
    bm25_fetch_k = max(top_k, int(os.getenv("RAG_BM25_FETCH_K", "20")))
    hybrid_alpha = float(os.getenv("RAG_HYBRID_ALPHA", "0.7"))
    hybrid_alpha = max(0.0, min(1.0, hybrid_alpha))

    # 1) 向量候選（FAISS distance 越小越好，轉成 similarity）
    vector_candidates = vector_store.similarity_search_with_score(query, k=vector_fetch_k)
    vector_map: Dict[str, Dict[str, Any]] = {}
    for doc, distance in vector_candidates or []:
        key = _doc_key(doc)
        vector_map[key] = {
            "doc": doc,
            "vector_raw_distance": float(distance),
            "vector_score": 1.0 / (1.0 + max(0.0, float(distance))),  # 轉成越大越好
            "bm25_score": 0.0,
        }

    # 2) BM25 候選語料：從 FAISS docstore 擷取
    docstore = getattr(vector_store, "docstore", None)
    docs_dict = getattr(docstore, "_dict", {}) if docstore is not None else {}
    corpus_items: List[Any] = list(docs_dict.values())[:bm25_corpus_limit]
    query_tokens = _tokenize_for_bm25(query)

    bm25_ranked: List[Any] = []
    if query_tokens and corpus_items:
        tokenized_docs = [_tokenize_for_bm25(d.page_content or "") for d in corpus_items]
        doc_count = len(tokenized_docs)
        avgdl = sum(len(toks) for toks in tokenized_docs) / max(1, doc_count)

        df: Dict[str, int] = {}
        for toks in tokenized_docs:
            for t in set(toks):
                df[t] = df.get(t, 0) + 1

        idf = {
            t: math.log(1.0 + (doc_count - freq + 0.5) / (freq + 0.5))
            for t, freq in df.items()
        }

        scored_docs = []
        for doc, toks in zip(corpus_items, tokenized_docs):
            score = _bm25_score(query_tokens, toks, idf, avgdl)
            if score > 0:
                scored_docs.append((doc, score))
        scored_docs.sort(key=lambda x: x[1], reverse=True)
        bm25_ranked = scored_docs[:bm25_fetch_k]

    # 3) 合併向量與 BM25
    for doc, bm25_score in bm25_ranked:
        key = _doc_key(doc)
        if key not in vector_map:
            vector_map[key] = {
                "doc": doc,
                "vector_raw_distance": None,
                "vector_score": 0.0,
                "bm25_score": float(bm25_score),
            }
        else:
            vector_map[key]["bm25_score"] = float(bm25_score)

    if not vector_map:
        return []

    max_vec = max((v["vector_score"] for v in vector_map.values()), default=0.0) or 1.0
    max_bm25 = max((v["bm25_score"] for v in vector_map.values()), default=0.0) or 1.0

    merged = []
    for item in vector_map.values():
        v_norm = item["vector_score"] / max_vec
        b_norm = item["bm25_score"] / max_bm25
        hybrid_score = hybrid_alpha * v_norm + (1.0 - hybrid_alpha) * b_norm
        merged.append((item["doc"], hybrid_score, v_norm, b_norm))

    merged.sort(key=lambda x: x[1], reverse=True)
    final_docs = [m[0] for m in merged[:top_k]]
    logger.info(
        "[RAG 混合檢索] vector_candidates=%d bm25_corpus=%d bm25_hits=%d merged=%d top_k=%d alpha=%.2f",
        len(vector_candidates or []),
        len(corpus_items),
        len(bm25_ranked),
        len(merged),
        top_k,
        hybrid_alpha,
    )
    return final_docs


def _normalize_lang_label(lang: str) -> str:
    """將舊資料中的英文語系值轉成顯示用中文標籤。"""
    raw = (lang or "").strip()
    lower = raw.lower()
    if lower in {"traditional chinese", "traditional chinese (taiwan)", "zh-tw", "zh_tw"}:
        return "繁體中文"
    if lower in {"english", "en", "en-us", "en_us"}:
        return "英文"
    return raw


def _build_user_prompt(assistant_description: str, lang: str, user_query: str, retrieval_context: Optional[str]) -> str:
    """以 DB 儲存的助理描述為系統指令本體；其後依助理設定的語系加上回覆指示，再加上使用者問題；若有檢索結果一併附上。"""
    blocks: List[str] = []
    desc = (assistant_description or "").strip()
    lang_label = _normalize_lang_label(lang)
    if desc:
        blocks.append(desc)
    if lang_label:
        blocks.append(f"請使用{lang_label}回答\n")
    blocks.append(f"### 使用者問題\n{user_query}")
    if retrieval_context:
        blocks.append(f"### 檢索結果\n{retrieval_context}")
    return "\n\n".join(blocks)


def _invoke_chat_text(
    llm: ChatOpenAI,
    text: str,
    *,
    assistant_uuid,
    log_branch: str = "",
) -> str:
    """
    LangChain 0.3+ 的 ChatOpenAI 不可再 llm(長字串)：字串會被當成 iterable，逐字變成「訊息」而觸發
    TypeError: Got unknown type 你。改為 invoke([HumanMessage(...)])。
    """
    total = len(text or "")
    max_chars_raw = os.getenv("LLM_PROMPT_LOG_MAX_CHARS", "24000")
    try:
        max_chars = max(1000, int(max_chars_raw))
    except ValueError:
        max_chars = 24000
    head = (text or "")[:max_chars]
    truncated = total > max_chars
    logger.info(
        "[LLM 送出的 prompt 摘要] assistant_uuid=%s branch=%s char_count=%d log_max_chars=%d truncated=%s",
        assistant_uuid,
        log_branch,
        total,
        max_chars,
        truncated,
    )
    logger.info(
        "[LLM 送出的 prompt 內容]\n%s%s",
        head,
        f"\n...(以下省略，共 {total} 字元；可調環境變數 LLM_PROMPT_LOG_MAX_CHARS 提高上限)" if truncated else "",
    )

    msg = HumanMessage(content=text)
    result = llm.invoke([msg])
    if hasattr(result, "content"):
        c = result.content
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            parts = []
            for block in c:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict) and "text" in block:
                    parts.append(str(block["text"]))
                else:
                    parts.append(str(block))
            return "".join(parts)
        return str(c)
    return str(result)


def _synch_process_llm(data, assistant_uuid, customer_unique_id, lang, model, assistant_description, welcome, noidea):
    """
    同步版本的 LLM 處理邏輯，包含向量檢索與單次 LLM 呼叫。
    此函數將被丟入 ThreadPoolExecutor 中執行，以免阻塞主要 Event Loop。
    data: 使用者的問題
    assistant_uuid: 助理 ID
    customer_unique_id: 客戶唯一 ID
    lang: 語言
    model: 模型
    assistant_description: 來自 AIAssistant.description（表單儲存的專屬 prompt）
    welcome: 歡迎提示
    noidea: 沒有想法提示
    """
    t_total_start = time.perf_counter()
    logger.info(
        "[LLM thread 開始] assistant_uuid=%s customer_id=%s lang=%s model=%s query_len=%d",
        assistant_uuid, customer_unique_id, lang, model, len(data or "")
    )

    t_vs_start = time.perf_counter()
    vector_store = get_vector_store(assistant_uuid)
    t_vs_s = time.perf_counter() - t_vs_start

    if not vector_store:
        logger.warning("[LLM] 無向量庫 assistant_uuid=%s (get_vector_store 耗時=%.3f s)，回傳 noidea", assistant_uuid, t_vs_s)
        return noidea
    logger.info("[LLM] get_vector_store 完成 (耗時=%.3f s)", t_vs_s)

    t_retrieve_start = time.perf_counter()
    relevant_docs = _hybrid_retrieve(vector_store, data)
    t_retrieve_s = time.perf_counter() - t_retrieve_start
    doc_count = len(relevant_docs) if relevant_docs else 0
    logger.info(
        "[LLM] 混合檢索完成 assistant_uuid=%s 相關文件數=%d (檢索耗時=%.3f s)",
        assistant_uuid, doc_count, t_retrieve_s
    )
    if doc_count > 0:
        logger.debug("[LLM] 檢索到文件預覽: %s", relevant_docs[0].page_content[:200] if relevant_docs else "")

    t_llm_init_start = time.perf_counter()
    runtime_model = VLLM_MODEL or model
    llm = ChatOpenAI(
        openai_api_key=VLLM_API_KEY,
        base_url=VLLM_BASE_URL,
        model=runtime_model,
        temperature=0.3,
        model_kwargs={"top_p": 0.9},
    )
    logger.info("[LLM] provider=vllm base_url=%s model=%s", VLLM_BASE_URL, runtime_model)
    
    user_query = data
    t_llm_init_s = time.perf_counter() - t_llm_init_start
    logger.debug("[LLM] 建構 user_query 與 LLM 實例 (耗時=%.3f s)", t_llm_init_s)

    if not relevant_docs:
        logger.info("[LLM] 無相關文件，使用助理 description + 使用者問題呼叫 LLM")
        full_prompt = _build_user_prompt(assistant_description, lang, user_query, retrieval_context=None)
        t_direct_start = time.perf_counter()
        response = _invoke_chat_text(
            llm,
            full_prompt,
            assistant_uuid=assistant_uuid,
            log_branch="無檢索文件",
        )
        t_direct_s = time.perf_counter() - t_direct_start
        t_total_s = time.perf_counter() - t_total_start
        logger.info(
            "[LLM 完成-無文件] assistant_uuid=%s 回覆長度=%d (直接 LLM=%.3f s 總耗時=%.3f s)",
            assistant_uuid, len(response or ""), t_direct_s, t_total_s
        )
        return response

    retrieval_text = "\n\n---\n\n".join(
        (d.page_content or "").strip() for d in relevant_docs if (d.page_content or "").strip()
    )
    logger.info("[LLM] 有相關文件，使用助理 description + 使用者問題 + 檢索結果呼叫 LLM")
    full_prompt = _build_user_prompt(assistant_description, lang, user_query, retrieval_context=retrieval_text)

    t_invoke_start = time.perf_counter()
    response = _invoke_chat_text(
        llm,
        full_prompt,
        assistant_uuid=assistant_uuid,
        log_branch="含檢索結果",
    )
    t_invoke_s = time.perf_counter() - t_invoke_start
    logger.info(
        "[LLM 完成-含檢索] assistant_uuid=%s 回覆長度=%d (LLM 耗時=%.3f s)",
        assistant_uuid, len(response or ""), t_invoke_s
    )

    t_chain_s = 0.0  # 已不再使用 RetrievalQA chain
    t_total_s = time.perf_counter() - t_total_start
    logger.info(
        "[LLM 總耗時] assistant_uuid=%s 總耗時=%.3f s (向量庫=%.3f 檢索=%.3f 建鏈=%.3f 呼叫LLM=%.3f)",
        assistant_uuid, t_total_s, t_vs_s, t_retrieve_s, t_chain_s, t_invoke_s
    )
    logger.debug("[LLM] 回覆預覽: %s", (response or "")[:200])
    return response


async def process_message_through_llm(data, assistant_uuid, customer_unique_id, lang, model, assistant_description, welcome, noidea):
    """
    非阻塞包裝：在 ThreadPoolExecutor 中執行同步的 LLM 操作，
    避免長時間運算 (如 150s) 卡住 asyncio 事件迴圈導致 WebSocket 斷線。
    """
    loop = asyncio.get_running_loop()
    # 使用 run_in_executor 將同步函式丟到執行緒池
    return await loop.run_in_executor(
        executor,
        _synch_process_llm,
        data, assistant_uuid, customer_unique_id, lang, model, assistant_description, welcome, noidea
    )
    # print("start to send to ws")
    # 將回覆透過 WebSocket 傳送給客戶
    # await websocket.send_text(response)

    # print("send ws finish")
    # 選擇性儲存對話紀錄至資料庫或 Redis（省略）
