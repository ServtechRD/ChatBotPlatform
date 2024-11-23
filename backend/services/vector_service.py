from datetime import datetime

from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.document_loaders import TextLoader, PyPDFLoader, UnstructuredWordDocumentLoader
from langchain.schema import Document
from langchain.chat_models import ChatOpenAI

from sqlalchemy.orm import Session
from fastapi import UploadFile
from dotenv import load_dotenv
from models.models import KnowledgeBase

from transformers import pipeline

from rake_nltk import Rake
from langchain.schema import HumanMessage

import faiss
import pickle

import os
import tiktoken  # 用于计算 token 数量
import uuid

import langid

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
    llm = ChatOpenAI(
        openai_api_key=api_key,  # 替换为你的 API 密钥
        model="gpt-3.5-turbo-16k"  # 使用支持更大上下文的模型
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
            summary = result[:marker_index].strip()
            keywords_line = result[marker_index + len(keyword_marker):].strip().replace(keyword_marker, "").strip()
        else:
            lines = result.strip().split("\n")

            if len(lines) > 1:
                summary = "\n".join(lines[:-1])  # 除最后一行外，其他行作为摘要
                keywords_line = lines[-1]  # 最后一行为关键词
            else:
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
        embeddings = OpenAIEmbeddings()  # 重新初始化 OpenAIEmbeddings

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
        raise ValueError(f"Vector store for assistant {assistant_id} is not initialized.")


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
    # 设置文件保存路径
    save_directory = f"./uploaded_files/assistant_{assistant_id}"
    if not os.path.exists(save_directory):
        os.makedirs(save_directory)

    file_location = os.path.join(save_directory, file.filename)

    # 保存上传的文件
    with open(file_location, "wb+") as f:
        f.write(await file.read())

    # 根据文件类型选择相应的文档加载器
    file_extension = file.filename.split(".")[-1].lower()
    loader = get_loader(file_location, file_extension)

    # 加载文档并生成嵌入
    documents = loader.load()
    documents = process_documents_with_id(documents)

    embeddings = OpenAIEmbeddings(openai_api_key=api_key)

    # 生成向量存储并缓存
    vector_store[assistant_id] = FAISS.from_documents(documents, embeddings)

    # 保存向量存储到磁盘
    save_vector_store(assistant_id, vector_store[assistant_id])

    # 计算 token 数量
    token_count = calculate_token_count(documents)

    # 提取所有文本内容
    full_text = " ".join([doc.page_content for doc in documents])

    # 生成摘要和關鍵詞
    summary, keyword_lines = generate_summary_and_keywords(full_text)

    # 获取 doc_id 列表
    doc_ids = [doc.metadata["doc_id"] for doc in documents]
    # 用逗号拼接
    doc_ids_string = ", ".join(doc_ids)

    print("save to database")

    # print(f"{summary_keywords}")

    # 保存元信息到数据库
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

    print("return result")

    return {
        "vector_store": vector_store[assistant_id],
        "km": {
            "file_name": new_entry.file_name,
            "description": new_entry.description,
            "token_count": new_entry.token_count,
            "file_type": new_entry.file_type,
            "summary": new_entry.summary,
            "keywords": new_entry.keywords,
            "doc_ids": new_entry.doc_ids,
            "upload_date": new_entry.upload_date
        }
    }


def list_knowledge(assistant_id: int, db: Session):
    records = db.query(KnowledgeBase).filter(KnowledgeBase.assistant_id == assistant_id).order_by(
        KnowledgeBase.upload_date.desc()).all()
    return [
        {
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
