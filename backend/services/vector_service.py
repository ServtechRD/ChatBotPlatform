from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.document_loaders import TextLoader, PyPDFLoader, UnstructuredWordDocumentLoader
import os
from sqlalchemy.orm import Session
from fastapi import UploadFile

# 用于获取向量存储
vector_store = {}


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
    embeddings = OpenAIEmbeddings()

    # 生成向量存储并缓存
    vector_store[assistant_id] = FAISS.from_documents(documents, embeddings)

    return vector_store[assistant_id]


# 获取助理的向量存储
def get_vector_store(assistant_id: int):
    if assistant_id not in vector_store:
        raise ValueError("Vector store for this assistant is not initialized.")

    return vector_store[assistant_id]
