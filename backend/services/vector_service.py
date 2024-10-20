import shutil

from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.document_loaders import TextLoader
import os

async def process_and_store_file(assistant_id: int, file, db):
    save_directory = f"./uploaded_files/assistant_{assistant_id}"
    if not os.path.exists(save_directory):
        os.makedirs(save_directory)

    file_location = os.path.join(save_directory, file.filename)
    with open(file_location, "wb+") as f:
        shutil.copyfileobj(file.file, f)

    # 加载文件并生成嵌入
    loader = TextLoader(file_location)
    documents = loader.load()

    embeddings = OpenAIEmbeddings()
    vector_store = FAISS.from_documents(documents, embeddings)

    return vector_store
