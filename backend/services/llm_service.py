from langchain.chat_models import ChatOpenAI  # pyright: ignore[reportMissingImports]
from langchain_core.messages import HumanMessage  # pyright: ignore[reportMissingImports]
from services.vector_service import get_vector_store

from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
import os
import time

from utils.logger import get_logger
from typing import List, Optional

import asyncio
from concurrent.futures import ThreadPoolExecutor

# Create a thread pool for LLM operations
executor = ThreadPoolExecutor(max_workers=10)

load_dotenv()  # 加载 .env 文件中的环境变量

api_key = os.getenv("OPENAI_API_KEY")

logger = get_logger(__name__)


def _build_user_prompt(assistant_description: str, lang: str, user_query: str, retrieval_context: Optional[str]) -> str:
    """以 DB 儲存的助理描述為系統指令本體，加上語系、使用者問題；若有檢索結果一併附上。"""
    blocks: List[str] = []
    desc = (assistant_description or "").strip()
    if desc:
        blocks.append(desc)
    blocks.append(f"### 預設回覆語系\n{lang}")
    blocks.append(f"### 使用者問題\n{user_query}")
    if retrieval_context:
        blocks.append(f"### 檢索結果\n{retrieval_context}")
    return "\n\n".join(blocks)


def _invoke_chat_text(llm: ChatOpenAI, text: str) -> str:
    """
    LangChain 0.3+ 的 ChatOpenAI 不可再 llm(長字串)：字串會被當成 iterable，逐字變成「訊息」而觸發
    TypeError: Got unknown type 你。改為 invoke([HumanMessage(...)])。
    """
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
    data: 用戶的問題
    assistant_uuid: 助手 ID
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
    t_vs_ms = (time.perf_counter() - t_vs_start) * 1000

    if not vector_store:
        logger.warning("[LLM] 無向量庫 assistant_uuid=%s (get_vector_store 耗時=%.2f ms)，回傳 noidea", assistant_uuid, t_vs_ms)
        return noidea
    logger.info("[LLM] get_vector_store 完成 (耗時=%.2f ms)", t_vs_ms)

    retriever = vector_store.as_retriever()

    t_retrieve_start = time.perf_counter()
    relevant_docs = retriever.get_relevant_documents(data)
    t_retrieve_ms = (time.perf_counter() - t_retrieve_start) * 1000
    doc_count = len(relevant_docs) if relevant_docs else 0
    logger.info(
        "[LLM] 向量檢索完成 assistant_uuid=%s 相關文件數=%d (檢索耗時=%.2f ms)",
        assistant_uuid, doc_count, t_retrieve_ms
    )
    if doc_count > 0:
        logger.debug("[LLM] 檢索到文件預覽: %s", relevant_docs[0].page_content[:200] if relevant_docs else "")

    t_llm_init_start = time.perf_counter()
    llm = ChatOpenAI(
        openai_api_key="ollama",
        base_url="http://192.168.1.187:11534/v1",
        model=model,
        temperature=0.5,
        model_kwargs={"top_p": 0.9, "extra_body": {"keep_alive": -1}}
    )
    if lang == "Traditional Chinese" or "繁體中文" in str(lang):
        user_query = f"#zh_tw {data}"
    else:
        user_query = data
    t_llm_init_ms = (time.perf_counter() - t_llm_init_start) * 1000
    logger.debug("[LLM] 建構 user_query 與 LLM 實例 (耗時=%.2f ms)", t_llm_init_ms)

    if not relevant_docs:
        logger.info("[LLM] 無相關文件，使用助理 description + 使用者問題呼叫 LLM")
        full_prompt = _build_user_prompt(assistant_description, lang, user_query, retrieval_context=None)
        t_direct_start = time.perf_counter()
        response = _invoke_chat_text(llm, full_prompt)
        t_direct_ms = (time.perf_counter() - t_direct_start) * 1000
        t_total_ms = (time.perf_counter() - t_total_start) * 1000
        logger.info(
            "[LLM 完成-無文件] assistant_uuid=%s 回覆長度=%d (直接 LLM=%.2f ms 總耗時=%.2f ms)",
            assistant_uuid, len(response or ""), t_direct_ms, t_total_ms
        )
        return response

    retrieval_text = "\n\n---\n\n".join(
        (d.page_content or "").strip() for d in relevant_docs if (d.page_content or "").strip()
    )
    logger.info("[LLM] 有相關文件，使用助理 description + 使用者問題 + 檢索結果呼叫 LLM")
    full_prompt = _build_user_prompt(assistant_description, lang, user_query, retrieval_context=retrieval_text)

    t_invoke_start = time.perf_counter()
    response = _invoke_chat_text(llm, full_prompt)
    t_invoke_ms = (time.perf_counter() - t_invoke_start) * 1000
    logger.info(
        "[LLM 完成-含檢索] assistant_uuid=%s 回覆長度=%d (LLM 耗時=%.2f ms)",
        assistant_uuid, len(response or ""), t_invoke_ms
    )

    t_chain_ms = 0.0  # 已不再使用 RetrievalQA chain
    t_total_ms = (time.perf_counter() - t_total_start) * 1000
    logger.info(
        "[LLM 總耗時] assistant_uuid=%s 總耗時=%.2f ms (向量庫=%.2f 檢索=%.2f 建鏈=%.2f 呼叫LLM=%.2f)",
        assistant_uuid, t_total_ms, t_vs_ms, t_retrieve_ms, t_chain_ms, t_invoke_ms
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
    # 将回复通过 WebSocket 发送给客户
    # await websocket.send_text(response)

    # print("send ws finish")
    # 选择性保存对话记录到数据库或 Redis（省略）
