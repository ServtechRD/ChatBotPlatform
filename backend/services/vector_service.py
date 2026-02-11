from datetime import datetime

# from langchain.embeddings import OpenAIEmbeddings
from langchain.embeddings import HuggingFaceEmbeddings # pyright: ignore[reportMissingImports]
from langchain.vectorstores import FAISS # pyright: ignore[reportMissingImports]
from langchain.document_loaders import TextLoader, PyPDFLoader, UnstructuredWordDocumentLoader # pyright: ignore[reportMissingImports]
from langchain.text_splitter import RecursiveCharacterTextSplitter # pyright: ignore[reportMissingImports]
from langchain.schema import Document  # pyright: ignore[reportMissingImports]
from langchain.chat_models import ChatOpenAI  # pyright: ignore[reportMissingImports]
from sqlalchemy.orm import Session  # pyright: ignore[reportMissingImports]
from fastapi import UploadFile  # pyright: ignore[reportMissingImports]
from starlette.concurrency import run_in_threadpool
from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
from models.models import KnowledgeBase  # pyright: ignore[reportMissingImports]
from transformers import pipeline  # pyright: ignore[reportMissingImports]
from rake_nltk import Rake  # pyright: ignore[reportMissingImports]
from langchain.schema import HumanMessage  # pyright: ignore[reportMissingImports]
import faiss # pyright: ignore[reportMissingImports]
import pickle

import os
import time
import tiktoken  # pyright: ignore[reportMissingImports]
import langid  # pyright: ignore[reportMissingImports]
import uuid

from utils.logger import get_logger

load_dotenv()  # 加载 .env 文件中的环境变量

logger = get_logger(__name__)

api_key = os.getenv("OPENAI_API_KEY")

# 用于获取向量存储
vector_store = {}

# 加载预训练的摘要生成模型
summarizer = pipeline("summarization")


def generate_doc_id():
    """
    生成唯一的文档 ID
    """
    return str(uuid.uuid4())


def process_documents_with_id(documents):
    """
    为每个文档生成一个唯一的 doc_id
    """
    for doc in documents:
        doc.metadata["doc_id"] = generate_doc_id()  # 将 doc_id 存入 metadata 中
    return documents


def generate_summary_and_keywords(text, max_summary_words=150, max_keywords=10):
    """
    使用 ChatOpenAI 一次生成摘要和关键词
    :param llm: ChatOpenAI 模型实例
    :param text: 输入文本
    :param max_summary_words: 摘要的最大字数限制
    :param max_keywords: 关键词的最大数量
    :return: 包含摘要和关键词的字典
    """

    # 语言代码与名称映射
    LANGUAGE_MAP = {
        "en": "English",
        "fr": "French",
        "es": "Spanish",
        "de": "German",
        "zh-cn": "Simplified Chinese",
        "zh-tw": "Traditional Chinese",
        "zh": "Traditional Chinese",
        # 新增其他语言映射
    }
    lang_code, _ = langid.classify(text)
    language = LANGUAGE_MAP.get(lang_code, "Traditional Chinese")
    print(f"language code = {lang_code}, lang = {language}")

    # 構建更明確的 Prompt，強制要求特定格式輸出
    prompt = (
        f"Please act as a professional document summarizer. Analyze the following text and provide a summary and keywords in {language}.\n\n"
        f"Requirements:\n"
        f"1. Summary: Concise and comprehensive, under {max_summary_words} words.\n"
        f"2. Keywords: Up to {max_keywords} relevant keywords, separated by commas.\n"
        f"3. Output Format: You MUST strictly follow the format below:\n\n"
        f"Summary: [Your summary here]\n"
        f"Keywords: [Keyword1, Keyword2, ...]\n\n"
        f"Text Content (truncated if too long):\n{text[:15000]}"  # 避免 context window 爆炸導致亂碼
    )

    # 初始化 ChatOpenAI 模型
    # 加入 temperature 參數以減少幻覺與亂碼
    llm = ChatOpenAI(
        openai_api_key="ollama",      # 本地端隨意填
        base_url="http://192.168.1.235:11534/v1",  # 指向 235 主機
        model="gpt-oss:20b",           # 使用指定模型
        temperature=0.2,               # 低溫度讓輸出更穩定
        model_kwargs={"extra_body": {"keep_alive": -1}}
    )
    
    try:
        response = llm([HumanMessage(content=prompt)])
        result = response.content.strip()
        print(f"summary and keywords raw result: {result}")
        
        summary = ""
        keywords_line = ""

        # 增強解析邏輯
        lines = result.split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # 檢查標記
            lower_line = line.lower()
            if lower_line.startswith("summary:") or lower_line.startswith("摘要:") or lower_line.startswith("summary：") or lower_line.startswith("摘要："):
                current_section = "summary"
                # 移除標記後取出內容
                content = line.split(':', 1)[-1].split('：', 1)[-1].strip()
                if content:
                    summary += content + " "
            elif lower_line.startswith("keywords:") or lower_line.startswith("关键词:") or lower_line.startswith("關鍵詞:") or lower_line.startswith("keywords："):
                current_section = "keywords"
                content = line.split(':', 1)[-1].split('：', 1)[-1].strip()
                if content:
                    keywords_line += content + " "
            elif current_section == "summary":
                summary += line + " "
            elif current_section == "keywords":
                keywords_line += line + " "

        # 如果解析失敗，使用回退邏輯
        if not summary and not keywords_line:
             print("Parsing failed, using fallback logic")
             # 回退到簡單分割
             if "Keywords:" in result:
                 parts = result.split("Keywords:")
                 summary = parts[0].replace("Summary:", "").strip()
                 keywords_line = parts[1].strip()
             elif "關鍵詞:" in result:
                 parts = result.split("關鍵詞:")
                 summary = parts[0].replace("摘要:", "").strip()
                 keywords_line = parts[1].strip()
             else:
                 summary = result  # 無法區分，全當摘要
        
        return summary.strip(), keywords_line.strip()

    except Exception as e:
        print(f"Error generating summary: {e}")
        # 出錯時回傳空值以免中斷流程
        return "Summary generation unavailable", ""


# 计算文档的 token 数量
def calculate_token_count(documents):
    tokenizer = tiktoken.get_encoding("cl100k_base")  # 根据模型选择编码
    token_count = 0
    for doc in documents:
        token_count += len(tokenizer.encode(doc.page_content))
    return token_count


# 用于保存向量存储
def save_vector_store(assistant_id: int, vector_store):
    save_path = f"./vector_stores/assistant_{assistant_id}.index"
    if not os.path.exists("./vector_stores"):
        os.makedirs("./vector_stores")
    faiss.write_index(vector_store.index, save_path)

    # 保存 docstore 和 index_to_docstore_id
    metadata_path = f"./vector_stores/assistant_{assistant_id}_metadata.pkl"
    with open(metadata_path, "wb") as f:
        metadata = {
            "docstore": vector_store.docstore,
            "index_to_docstore_id": vector_store.index_to_docstore_id
        }
        pickle.dump(metadata, f)


def load_vector_store(assistant_id: int):
    load_path = f"./vector_stores/assistant_{assistant_id}.index"
    metadata_path = f"./vector_stores/assistant_{assistant_id}_metadata.pkl"

    if os.path.exists(load_path) and os.path.exists(metadata_path):
        # 从磁盘加载 FAISS 索引
        index = faiss.read_index(load_path)
        # embeddings = OpenAIEmbeddings()  # 重新初始化 OpenAIEmbeddings
        embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-base-zh-v1.5")

        # 加载 docstore 和 index_to_docstore_id
        with open(metadata_path, "rb") as f:
            metadata = pickle.load(f)
            docstore = metadata["docstore"]
            index_to_docstore_id = metadata["index_to_docstore_id"]

        # 使用 from_index 方法来加载已存在的 FAISS 索引
        vector_store[assistant_id] = FAISS(
            index=index,
            docstore=docstore,
            index_to_docstore_id=index_to_docstore_id,
            embedding_function=embeddings.embed_query
        )

        return vector_store[assistant_id]
    else:
        # 返回空的 FAISS 对象
        return None
        #embeddings = OpenAIEmbeddings()
        #return FAISS.from_texts([], embeddings)  # 空的文本列表
        #raise ValueError(f"Vector store for assistant {assistant_id} is not initialized.")


# 根据文件类型选择加载器
def get_loader(file_path: str, file_type: str):
    if file_type == "pdf":
        return PyPDFLoader(file_path)
    elif file_type == "docx":
        return UnstructuredWordDocumentLoader(file_path)
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
    在線程池中執行的同步重邏輯：載入文件、分塊、嵌入、寫入向量庫與磁碟、生成摘要。
    DB 寫入由呼叫方在主線程執行。
    """
    t_start = time.perf_counter()
    try:
        loader = get_loader(file_location, file_extension)
        t_load = time.perf_counter()
        documents = loader.load()
        if not documents:
            logger.warning("[上傳檔案] 載入後無文件內容 path=%s ext=%s", file_location, file_extension)
        t_load_ms = (time.perf_counter() - t_load) * 1000
        logger.info("[上傳檔案] loader.load 完成 doc_count=%d (耗時=%.2f ms)", len(documents), t_load_ms)

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""]
        )
        documents = text_splitter.split_documents(documents)
        documents = process_documents_with_id(documents)

        embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-base-zh-v1.5")
        if vs:
            test_emb = embeddings.embed_query("test")
            if len(test_emb) != vs.index.d:
                raise ValueError(
                    f"Vector store dimension mismatch (Index: {vs.index.d}, Model: {len(test_emb)}). "
                    "Please reset knowledge base for this assistant."
                )
            doc_ids = [doc.metadata["doc_id"] for doc in documents]
            vs.add_documents(documents, ids=doc_ids)
            vector_store[assistant_id] = vs
        else:
            doc_ids = [doc.metadata["doc_id"] for doc in documents]
            vector_store[assistant_id] = FAISS.from_documents(documents, embeddings, ids=doc_ids)
            vs = vector_store[assistant_id]

        save_vector_store(assistant_id, vs)
        token_count = calculate_token_count(documents)
        full_text = " ".join([doc.page_content for doc in documents])
        summary, keyword_lines = generate_summary_and_keywords(full_text)
        doc_ids_string = ", ".join(doc_ids)

        t_total_ms = (time.perf_counter() - t_start) * 1000
        logger.info(
            "[上傳檔案 重邏輯完成] assistant_id=%s filename=%s chunks=%d token_count=%d 耗時=%.2f ms",
            assistant_id, filename, len(documents), token_count, t_total_ms
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


# 处理并存储文件嵌入到向量数据库
async def process_and_store_file(assistant_id: int, file: UploadFile, db: Session):
    t_start = time.perf_counter()
    filename = file.filename or "(unnamed)"
    logger.info(
        "[上傳檔案 開始] assistant_id=%s filename=%s content_type=%s",
        assistant_id, filename, getattr(file, "content_type", None)
    )

    try:
        # 輕量步驟留在主線程：查詢 DB 與向量庫
        t_q = time.perf_counter()
        existing_entry = db.query(KnowledgeBase).filter(
            KnowledgeBase.assistant_id == assistant_id,
            KnowledgeBase.file_name == filename
        ).first()
        vs = get_vector_store(assistant_id)
        t_q_ms = (time.perf_counter() - t_q) * 1000
        logger.info(
            "[上傳檔案] 查詢既有知識庫與向量庫 完成 existing=%s vs_exists=%s (耗時=%.2f ms)",
            existing_entry is not None, vs is not None, t_q_ms
        )

        if existing_entry and vs:
            old_doc_ids = [did.strip() for did in (existing_entry.doc_ids or "").split(",") if did.strip()]
            if old_doc_ids:
                try:
                    vs.delete(old_doc_ids)
                    logger.info("[上傳檔案] 刪除舊向量 完成 filename=%s old_doc_count=%d", filename, len(old_doc_ids))
                except Exception as e:
                    logger.warning("[上傳檔案] 刪除舊向量失敗（繼續上傳） filename=%s error=%s", filename, e, exc_info=True)

        save_directory = f"./uploaded_files/assistant_{assistant_id}"
        os.makedirs(save_directory, exist_ok=True)
        file_location = os.path.join(save_directory, filename)

        t_read = time.perf_counter()
        content = await file.read()
        file_size = len(content)
        logger.info("[上傳檔案] 讀取上傳內容 完成 size=%d bytes (耗時=%.2f ms)", file_size, (time.perf_counter() - t_read) * 1000)

        with open(file_location, "wb+") as f:
            f.write(content)
        logger.info("[上傳檔案] 寫入磁碟 完成 path=%s", file_location)

        file_extension = filename.split(".")[-1].lower() if "." in filename else ""
        if not file_extension:
            raise ValueError("File must have an extension")

        # 重邏輯丟到線程池，避免阻塞其他 API
        heavy_result = await run_in_threadpool(
            _process_and_store_file_heavy_sync,
            assistant_id,
            file_location,
            filename,
            file_extension,
            vs,
        )

        doc_ids_string = heavy_result["doc_ids_string"]
        summary = heavy_result["summary"]
        keyword_lines = heavy_result["keyword_lines"]
        token_count = heavy_result["token_count"]
        file_extension = heavy_result["file_extension"]

        # DB 寫入僅在主線程執行（Session 非線程安全）
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
                assistant_id=assistant_id,
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

        vs = vector_store.get(assistant_id)
        t_total_ms = (time.perf_counter() - t_start) * 1000
        logger.info(
            "[上傳檔案 完成] assistant_id=%s filename=%s token_count=%d 總耗時=%.2f ms",
            assistant_id, filename, token_count, t_total_ms
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
        t_total_ms = (time.perf_counter() - t_start) * 1000
        logger.exception(
            "[上傳檔案 失敗] assistant_id=%s filename=%s 總耗時=%.2f ms error=%s",
            assistant_id, filename, t_total_ms, e
        )
        raise


def get_vector_store_status(assistant_id: int):
    """
    獲取向量存儲的狀態與統計資訊
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
        print(f"Error reading docstore metadata: {e}")

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


def get_vector_store(assistant_id: int):
    if assistant_id not in vector_store:
        # 如果向量存储不在内存中，从磁盘加载
        return load_vector_store(assistant_id)
        # raise ValueError("Vector store for this assistant is not initialized.")

    return vector_store[assistant_id]


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


async def update_knowledge_base_item(assistant_id: int, knowledge_id: int, new_content: str, db: Session):
    # 1. Find record
    record = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_id,
                                            KnowledgeBase.assistant_id == assistant_id).first()
    if not record:
        raise ValueError("Knowledge base item not found")

    # 2. Get Vector Store
    vs = get_vector_store(assistant_id)
    
    # 3. Delete old vectors (best effort - may not exist if store was rebuilt)
    old_doc_ids = [did.strip() for did in record.doc_ids.split(",") if did.strip()]
    if vs and old_doc_ids:
        try:
            print(f"Attempting to delete old vectors: {old_doc_ids}")
            vs.delete(old_doc_ids)
            print(f"Successfully deleted old vectors")
        except Exception as e:
            # Log but continue - old vectors might not exist if store was rebuilt
            print(f"Warning: Could not delete old vectors (continuing anyway): {e}")
    else:
        print(f"No vector store or no old doc_ids to delete")

    # 4. Overwrite existing file
    save_directory = f"./uploaded_files/assistant_{assistant_id}"
    if not os.path.exists(save_directory):
        os.makedirs(save_directory)
    
    # Use existing filename to overwrite
    new_filename = record.file_name
    new_file_path = os.path.join(save_directory, new_filename)

    print(f"Overwriting file: {new_file_path}")
    with open(new_file_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    # 5. Process updated file
    loader = TextLoader(new_file_path, encoding="utf-8")
    documents = loader.load()
    
    # 使用 RecursiveCharacterTextSplitter 进行分块
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""]
    )
    documents = text_splitter.split_documents(documents)

    documents = process_documents_with_id(documents)
    
    embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-base-zh-v1.5")
    
    # Add new documents to vector store
    if vs:
        # Check for dimension mismatch
        test_emb = embeddings.embed_query("test")
        if len(test_emb) != vs.index.d:
            error_msg = f"Vector store dimension mismatch (Index: {vs.index.d}, Model: {len(test_emb)}). Please reset knowledge base for this assistant."
            print(f"CRITICAL ERROR: {error_msg}")
            raise ValueError(error_msg)

        print(f"Adding new vectors for {new_filename}")
        doc_ids = [doc.metadata["doc_id"] for doc in documents]
        vs.add_documents(documents, ids=doc_ids)
    else:
        # Create new if didn't exist
        print(f"Creating new vector store for assistant {assistant_id}")
        doc_ids = [doc.metadata["doc_id"] for doc in documents]
        vector_store[assistant_id] = FAISS.from_documents(documents, embeddings, ids=doc_ids)
        vs = vector_store[assistant_id]
    
    save_vector_store(assistant_id, vs)

    # 6. Update DB Record
    # Calculate new token count
    token_count = calculate_token_count(documents)
    
    # Generate new summary/keywords
    summary, keyword_lines = generate_summary_and_keywords(new_content)
    
    # Get new doc_ids
    new_doc_ids = [doc.metadata["doc_id"] for doc in documents]
    
    record.summary = summary
    record.keywords = keyword_lines
    record.doc_ids = ", ".join(new_doc_ids)
    record.token_count = token_count
    record.upload_date = datetime.utcnow() # Update modified time
    
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
