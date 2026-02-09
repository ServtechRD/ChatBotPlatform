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
from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
from models.models import KnowledgeBase  # pyright: ignore[reportMissingImports]
from transformers import pipeline  # pyright: ignore[reportMissingImports]
from rake_nltk import Rake  # pyright: ignore[reportMissingImports]
from langchain.schema import HumanMessage  # pyright: ignore[reportMissingImports]
import faiss # pyright: ignore[reportMissingImports]
import pickle

import os
import tiktoken  # pyright: ignore[reportMissingImports] 
import langid # pyright: ignore[reportMissingImports]
import uuid

load_dotenv()  # 加载 .env 文件中的环境变量

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
        "zh-cn": "Chinese",
        "zh-tw": "Traditional Chinese",
        "zh": "Traditional Chinese",
        # 添加其他语言映射
    }
    lang_code, _ = langid.classify(text)
    language = LANGUAGE_MAP.get(lang_code, "English")
    print(f"language code = {lang_code}, lang = {language}")

    prompt = (
        f"Summarize the following text in {language}, ensuring the summary is less than {max_summary_words} words. "
        f"Also, provide up to {max_keywords} keywords in {language}. "
        f"The keywords should be comma-separated.\n\n"
        f"Text:\n{text}"
    )

    # 初始化 ChatOpenAI 模型
    # llm = ChatOpenAI(
    #     openai_api_key=api_key,  # 替换为你的 API 密钥
    #     model="gpt-3.5-turbo"  # 使用支持更大上下文的模型
    # )

    # 利用 Local Ollama (235主機) 生成回覆
    llm = ChatOpenAI(
        openai_api_key="ollama",      # 本地端隨意填
        base_url="http://192.168.1.235:11534/v1",  # 指向 235 主機
        model="gpt-oss:20b"           # 使用指定模型
    )
    
    response = llm([HumanMessage(content=prompt)])
    result = response.content.strip()
    print(f"summary and keywords :{result}")
    # 分隔 summary 和 keywords
    try:

        keyword_marker = "Keywords"
        if lang_code == "zh-cn":
            keyword_marker = "关键词"
        elif lang_code.startswith("zh"):
            keyword_marker = "關鍵詞"

        # 查找关键词标志的位置
        marker_index = result.find(keyword_marker)

        if marker_index != -1:
            # 提取摘要和关键词部分
            print(f"find  {keyword_marker} => {marker_index}")
            summary = result[:marker_index].strip()
            keywords_line = result[marker_index + len(keyword_marker):].strip()
        else:
            print("use last line")
            lines = result.strip().split("\n")

            if len(lines) > 1:
                summary = "\n".join(lines[:-1])  # 除最后一行外，其他行作为摘要
                keywords_line = lines[-1]  # 最后一行为关键词
            else:
                print("no last line")
                summary = result.strip()
                keywords_line = ""
        return summary, keywords_line
    except ValueError:
        raise ValueError("The response format is incorrect. Ensure the delimiter '---' is present.")


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


# 处理并存储文件嵌入到向量数据库
async def process_and_store_file(assistant_id: int, file: UploadFile, db: Session):
    # Check for existing entry with same name for this assistant
    existing_entry = db.query(KnowledgeBase).filter(
        KnowledgeBase.assistant_id == assistant_id,
        KnowledgeBase.file_name == file.filename
    ).first()

    # Get existing vector store or load it
    vs = get_vector_store(assistant_id)

    # If duplicate, delete old vectors first
    if existing_entry and vs:
        old_doc_ids = [did.strip() for did in existing_entry.doc_ids.split(",") if did.strip()]
        if old_doc_ids:
            try:
                print(f"Deleting old vectors for duplicate file {file.filename}: {old_doc_ids}")
                vs.delete(old_doc_ids)
            except Exception as e:
                print(f"Warning deleting old vectors during upload: {e}")

    # 设置文件保存路径
    save_directory = f"./uploaded_files/assistant_{assistant_id}"
    if not os.path.exists(save_directory):
        os.makedirs(save_directory)

    file_location = os.path.join(save_directory, file.filename)

    # 保存上传的文件 (overwrites on disk)
    with open(file_location, "wb+") as f:
        f.write(await file.read())

    # 根据文件类型选择相应的文档加载器
    file_extension = file.filename.split(".")[-1].lower()
    loader = get_loader(file_location, file_extension)

    # 加载文档并生成嵌入
    documents = loader.load()

    # 使用 RecursiveCharacterTextSplitter 进行分块
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""]
    )
    documents = text_splitter.split_documents(documents)

    documents = process_documents_with_id(documents)

    # 使用 Jarvis 同款的中文 Embedding 模型
    embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-base-zh-v1.5")

    # 更新或生成向量存儲
    if vs:
        # Check for dimension mismatch
        test_emb = embeddings.embed_query("test")
        if len(test_emb) != vs.index.d:
            error_msg = f"Vector store dimension mismatch (Index: {vs.index.d}, Model: {len(test_emb)}). Please reset knowledge base for this assistant."
            print(f"CRITICAL ERROR: {error_msg}")
            raise ValueError(error_msg)

        print(f"Adding documents to existing vector store for assistant {assistant_id}")
        doc_ids = [doc.metadata["doc_id"] for doc in documents]
        vs.add_documents(documents, ids=doc_ids)
        vector_store[assistant_id] = vs
    else:
        print(f"Creating new vector store for assistant {assistant_id}")
        doc_ids = [doc.metadata["doc_id"] for doc in documents]
        vector_store[assistant_id] = FAISS.from_documents(documents, embeddings, ids=doc_ids)
        vs = vector_store[assistant_id]

    # 保存向量存储到磁盘
    save_vector_store(assistant_id, vs)

    # 计算 token 数量
    token_count = calculate_token_count(documents)

    # 提取所有文本内容
    full_text = " ".join([doc.page_content for doc in documents])

    # 生成摘要和關鍵詞
    summary, keyword_lines = generate_summary_and_keywords(full_text)

    # 获取 doc_id 列表
    doc_ids = [doc.metadata["doc_id"] for doc in documents]
    doc_ids_string = ", ".join(doc_ids)

    if existing_entry:
        print(f"Updating existing database entry for {file.filename}")
        existing_entry.summary = summary
        existing_entry.keywords = keyword_lines
        existing_entry.doc_ids = doc_ids_string
        existing_entry.token_count = token_count
        existing_entry.upload_date = datetime.utcnow()
        db.commit()
        db.refresh(existing_entry)
        entry_to_return = existing_entry
    else:
        print(f"Creating new database entry for {file.filename}")
        new_entry = KnowledgeBase(
            assistant_id=assistant_id,
            file_name=file.filename,
            file_type=f"{file_extension.upper()}",
            summary=summary,
            keywords=keyword_lines,
            doc_ids=doc_ids_string,
            description=f"Uploaded file {file.filename} by assistant {assistant_id}",
            token_count=token_count,
            upload_date=datetime.utcnow()
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        entry_to_return = new_entry

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
