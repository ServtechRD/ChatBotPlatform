from langchain.chains import RetrievalQA  # pyright: ignore[reportMissingImports]
from langchain.chat_models import ChatOpenAI  # pyright: ignore[reportMissingImports]
from langchain.prompts import PromptTemplate  # pyright: ignore[reportMissingImports]
from services.vector_service import get_vector_store
# from langchain.chains.combine_documents import StuffDocumentsChain

from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
import os
import time

from utils.logger import get_logger

load_dotenv()  # 加载 .env 文件中的环境变量

api_key = os.getenv("OPENAI_API_KEY")
logger = get_logger(__name__)



def _synch_process_llm(data, assistant_uuid, customer_unique_id, lang, model, prompt1, prompt2, welcome, noidea):
    """
    同步版本的 LLM 處理邏輯，包含向量檢索與 QA Chain 呼叫。
    此函數將被丟入 ThreadPoolExecutor 中執行，以免阻塞主要 Event Loop。
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
        base_url="http://192.168.1.235:11534/v1",
        model=model,
        model_kwargs={"extra_body": {"keep_alive": -1}}
    )
    if lang == "Traditional Chinese" or "繁體中文" in str(lang):
        user_query = f"#zh_tw {data}"
    else:
        user_query = data
    t_llm_init_ms = (time.perf_counter() - t_llm_init_start) * 1000
    logger.debug("[LLM] 建構 user_query 與 LLM 實例 (耗時=%.2f ms)", t_llm_init_ms)

    if not relevant_docs:
        logger.info("[LLM] 無相關文件，使用 prompt1 直接呼叫 LLM")
        system_prompt = prompt1.replace("$language", lang).replace("$data", user_query)
        t_direct_start = time.perf_counter()
        response = llm(system_prompt)
        t_direct_ms = (time.perf_counter() - t_direct_start) * 1000
        t_total_ms = (time.perf_counter() - t_total_start) * 1000
        logger.info(
            "[LLM 完成-無文件] assistant_uuid=%s 回覆長度=%d (直接 LLM=%.2f ms 總耗時=%.2f ms)",
            assistant_uuid, len(response or ""), t_direct_ms, t_total_ms
        )
        return response

    system_prompt = prompt2.replace("$language", lang).replace("$data", user_query)
    system_prompt = system_prompt.replace("$doc", "{context}")

    prompt_template = PromptTemplate(
        input_variables=["context"],
        template=system_prompt
    )

    t_chain_start = time.perf_counter()
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=False,
        chain_type_kwargs={"prompt": prompt_template},
    )
    t_chain_ms = (time.perf_counter() - t_chain_start) * 1000
    logger.debug("[LLM] 建立 QA chain (耗時=%.2f ms)", t_chain_ms)

    t_invoke_start = time.perf_counter()
    try:
        res = qa_chain.invoke({"context": "customer service", "query": user_query})
        response = res.get("result", str(res))
    except Exception as e:
        logger.warning("[LLM] invoke 失敗改 run: %s", e)
        t_fallback_start = time.perf_counter()
        response = qa_chain.run({"context": "customer service", "query": user_query})
        t_invoke_ms = (time.perf_counter() - t_fallback_start) * 1000
        logger.info("[LLM] run 完成 (fallback 耗時=%.2f ms)", t_invoke_ms)
    else:
        t_invoke_ms = (time.perf_counter() - t_invoke_start) * 1000
        logger.info(
            "[LLM] QA chain invoke 完成 assistant_uuid=%s 回覆長度=%d (invoke 耗時=%.2f ms)",
            assistant_uuid, len(response or ""), t_invoke_ms
        )

    t_total_ms = (time.perf_counter() - t_total_start) * 1000
    logger.info(
        "[LLM 總耗時] assistant_uuid=%s 總耗時=%.2f ms (向量庫=%.2f 檢索=%.2f 建鏈=%.2f 呼叫LLM=%.2f)",
        assistant_uuid, t_total_ms, t_vs_ms, t_retrieve_ms, t_chain_ms, t_invoke_ms
    )
    logger.debug("[LLM] 回覆預覽: %s", (response or "")[:200])
    return response


async def process_message_through_llm(data, assistant_uuid, customer_unique_id, lang, model, prompt1, prompt2, welcome, noidea):
    """
    非阻塞包裝：在 ThreadPoolExecutor 中執行同步的 LLM 操作，
    避免長時間運算 (如 150s) 卡住 asyncio 事件迴圈導致 WebSocket 斷線。
    """
    loop = asyncio.get_running_loop()
    # 使用 run_in_executor 將同步函式丟到執行緒池
    return await loop.run_in_executor(
        executor, 
        _synch_process_llm,
        data, assistant_uuid, customer_unique_id, lang, model, prompt1, prompt2, welcome, noidea
    )
    # print("start to send to ws")
    # 将回复通过 WebSocket 发送给客户
    # await websocket.send_text(response)

    # print("send ws finish")
    # 选择性保存对话记录到数据库或 Redis（省略）
