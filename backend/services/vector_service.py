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


def extract_keywords_as_string(text, max_keywords=10, separator=", "):
    """
    提取关键词并返回一个字符串
    :param text: 输入的文本
    :param max_keywords: 最大关键词数量
    :param separator: 关键词之间的分隔符
    :return: 拼接好的关键词字符串
    """
    rake = Rake()
    rake.extract_keywords_from_text(text)
    keywords = rake.get_ranked_phrases()[:max_keywords]  # 提取关键词列表
    return separator.join(keywords)  # 拼接成一个字符串


def generate_summary(text, max_length=150, min_length=30):
    """
    使用 OpenAI GPT 模型生成摘要
    :param text: 输入文本
    :param max_length: 摘要的最大长度
    :return: 摘要字符串
    """
    prompt = (
        f"Please summarize the following text into a concise summary of less than {max_length} words:\n\n{text}"
    )

    # 初始化 ChatOpenAI 模型
    llm = ChatOpenAI(
        openai_api_key=api_key,  # 替换为你的 API 密钥
        model="gpt-3.5-turbo-16k"  # 使用支持更大上下文的模型
    )
    response = llm([HumanMessage(content=prompt)])
    return response.content.strip()


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

    # 生成摘要
    summary = generate_summary(full_text)

    # 生成关键词字符串
    keywords_string = extract_keywords_as_string(full_text)

    # 获取 doc_id 列表
    doc_ids = [doc.metadata["doc_id"] for doc in documents]
    # 用逗号拼接
    doc_ids_string = ", ".join(doc_ids)

    # 保存元信息到数据库
    new_entry = KnowledgeBase(
        assistant_id=assistant_id,
        file_name=file.filename,
        file_type=f"{file_extension.upper()}",
        summary=summary,
        keywords=keywords_string,
        doc_ids=doc_ids_string,
        description=f"Uploaded file {file.filename} by assistant {assistant_id}",
        token_count=token_count,
        upload_date=datetime.utcnow()
    )

    db.add(new_entry)
    db.commit()

    return {
        "vector_store": vector_store[assistant_id],
        "knowledge_info": {
            "file_name": new_entry.file_name,
            "description": new_entry.description,
            "token_count": new_entry.token_count,
            "file_type": new_entry.file_type,
            "summary": new_entry.summary,
            "keywords": new_entry.keywords,
            "doc_ids": new_entry.doc_ids,
            "upload_date": new_entry.upload_date
        }

        # 获取助理的向量存储
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
