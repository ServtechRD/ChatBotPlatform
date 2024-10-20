from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI
from services.vector_service import get_vector_store
from langchain.schema import Document
#from langchain.chains.combine_documents import StuffDocumentsChain

from dotenv import load_dotenv
import os

load_dotenv()  # 加载 .env 文件中的环境变量

api_key = os.getenv("OPENAI_API_KEY")
async def process_message_through_llm(data, assistant_uuid, customer_unique_id):
    # 从 Redis 或数据库中获取对话历史记录（省略）
    # 从向量数据库中检索相关文档

    print("assistant uudi = "+assistant_uuid)

    vector_store = get_vector_store(assistant_uuid)

    print(vector_store)



    # 利用客户输入生成嵌入向量进行检索
    retriever = vector_store.as_retriever()  # 调用 .as_retriever() 来获取检索器

    print("get retriever")

    relevant_docs = retriever.get_relevant_documents(data)


    print("start to find docs")
    # 打印检索到的文档内容
    #for doc in relevant_docs:
    #    print(f"Retrieved document: {doc.page_content}")

    print("end find docs")

    print("create llm")
    # 利用 OpenAI GPT 生成基于检索结果的回复
    llm = ChatOpenAI(openai_api_key=api_key, model="gpt-3.5-turbo-16k")

    # 使用 StuffDocumentsChain 作为文档组合链
    #combine_documents_chain = StuffDocumentsChain(llm=llm)

    #qa_chain = RetrievalQA(llm=llm, retriever=retriever)

    # 通过 `RetrievalQA.from_chain_type` 方法初始化
    print("crate qa_chain")

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",  # 这是最简单的文档组合方式
        retriever=retriever,

    )

    print("ask llm with data and qachain")
    # 通过 LLM 处理客户消息，生成回复
    response = qa_chain.run(data)

    print("got response")
    print(response)
    return response
    #print("start to send to ws")
    # 将回复通过 WebSocket 发送给客户
    #await websocket.send_text(response)

    #print("send ws finish")
    # 选择性保存对话记录到数据库或 Redis（省略）

