from langchain.chains import RetrievalQA  # pyright: ignore[reportMissingImports]
from langchain.chat_models import ChatOpenAI  # pyright: ignore[reportMissingImports]
from langchain.prompts import PromptTemplate  # pyright: ignore[reportMissingImports]
from services.vector_service import get_vector_store  
# from langchain.chains.combine_documents import StuffDocumentsChain

from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]
import os

load_dotenv()  # 加载 .env 文件中的环境变量

api_key = os.getenv("OPENAI_API_KEY")


async def process_message_through_llm(data, assistant_uuid, customer_unique_id, lang, model, prompt1, prompt2, welcome,
                                      noidea):
    # 从 Redis 或数据库中获取对话历史记录（省略）
    # 从向量数据库中检索相关文档

    print("assistant uuid = " + assistant_uuid)

    vector_store = get_vector_store(assistant_uuid)

    if not vector_store:
        print("No vector store found.")
        return noidea

    print(vector_store)

    # 利用客户输入生成嵌入向量进行检索
    retriever = vector_store.as_retriever()  # 调用 .as_retriever() 来获取检索器

    print("get retriever")

    relevant_docs = retriever.get_relevant_documents(data)

    print("start to find docs")
    # 打印检索到的文档内容
    # for doc in relevant_docs:
    #    print(f"Retrieved document: {doc.page_content}")

    print("end find docs")

    print("create llm")
    # 利用 OpenAI GPT 生成基于检索结果的回复
    # llm = ChatOpenAI(openai_api_key=api_key, model=model)

    # 利用 Local Ollama (235主機) 生成回覆
    llm = ChatOpenAI(
        openai_api_key="ollama",  # 本地端隨意填即可
        base_url="http://192.168.1.235:11534/v1",  # 指向 235 主機
        model=model
    )

    print(f"lang  => {lang}")
    
    # 如果是繁體中文，在用戶訊息前加上 #zh_tw
    if lang == "Traditional Chinese" or "繁體中文" in str(lang):
        user_query = f"#zh_tw {data}"
    else:
        user_query = data
    
    print(f"data => {user_query}")
    # 沒查到
    if not relevant_docs:
        system_prompt = prompt1.replace("$language", lang).replace("$data", user_query)
        response = llm(system_prompt)
        print("Response generated without documents.")
        return response

    # 使用 StuffDocumentsChain 作为文档组合链
    # combine_documents_chain = StuffDocumentsChain(llm=llm)

    # 创建 PromptTemplate

    # qa_chain = RetrievalQA(llm=llm, retriever=retriever)
    system_prompt = prompt2.replace("$language", lang).replace("$data", user_query)
    doc_contents = "\n\n".join([doc.page_content for doc in relevant_docs])
    system_prompt = system_prompt.replace("$doc", doc_contents)

    print(f"prompt => {prompt2}")
    prompt_template = PromptTemplate(
        input_variables=["context"],  # 定义变量
        template=system_prompt  # 模板内容
    )
    # 通过 `RetrievalQA.from_chain_type` 方法初始化
    print("crate qa_chain")

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",  # 这是最简单的文档组合方式
        retriever=retriever,
        return_source_documents=False,
        chain_type_kwargs={"prompt": prompt_template},
    )

    print("ask llm with data and qa chain")
    # print(f"doc :{doc_contents}")
    print(f"lang: {lang}")
    print(f"query:{user_query}")
    # 通过 LLM 处理客户消息，生成回复
    response = qa_chain.run({"context": "customer service", "query": user_query})

    print("got response")
    print(response)
    return response
    # print("start to send to ws")
    # 将回复通过 WebSocket 发送给客户
    # await websocket.send_text(response)

    # print("send ws finish")
    # 选择性保存对话记录到数据库或 Redis（省略）
