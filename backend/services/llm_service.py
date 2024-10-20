from langchain.chains import RetrievalQA
from langchain.llms import OpenAI
from app.services.vector_service import get_vector_store
from langchain.schema import Document


async def process_message_through_llm(websocket, assistant_uuid, customer_unique_id):
    # 从 Redis 或数据库中获取对话历史记录（省略）
    # 从向量数据库中检索相关文档
    vector_store = get_vector_store(assistant_uuid)

    while True:
        # 从 WebSocket 接收客户的消息
        data = await websocket.receive_text()

        # 利用客户输入生成嵌入向量进行检索
        retriever = vector_store.as_retriever()
        relevant_docs = retriever.get_relevant_documents(data)

        # 打印检索到的文档内容
        for doc in relevant_docs:
            print(f"Retrieved document: {doc.page_content}")

        # 利用 OpenAI GPT 生成基于检索结果的回复
        llm = OpenAI()
        qa_chain = RetrievalQA(llm=llm, retriever=retriever)

        # 通过 LLM 处理客户消息，生成回复
        response = qa_chain.run(data)

        # 将回复通过 WebSocket 发送给客户
        await websocket.send_text(response)

        # 选择性保存对话记录到数据库或 Redis（省略）

