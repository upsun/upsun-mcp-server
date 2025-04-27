from openai import AsyncOpenAI
from mcp import ClientSession
import chainlit as cl
client = AsyncOpenAI()

# Instrument the OpenAI client
cl.instrument_openai()

settings = {
    "model": "gpt-4.1-nano",
    "temperature": 0.7,
    "max_tokens": 500,
    "top_p": 1,
    "frequency_penalty": 0,
    "presence_penalty": 0,
    # "streaming": True,
    # ... more settings
}

@cl.on_message
async def on_message(message: cl.Message): 
    response = await client.chat.completions.create(
        messages=[
            {
                "content": "You are a helpful assistant to help me manage upsun projects.",
                "role": "system"
            },
            {
                "content": message.content,
                "role": "user"
            }
        ],
        **settings
    )
    await cl.Message(content=response.choices[0].message.content).send()

    # message_history = cl.user_session.get("message_history")
    # message_history.append({"role": "user", "content": message.content})
    # msg = cl.Message(content="")

    # stream = await client.chat.completions.create(
    #     messages=message_history, stream=True, **settings
    # )

    # async for part in stream:
    #     if token := part.choices[0].delta.content or "":
    #         await msg.stream_token(token)

    # message_history.append({"role": "assistant", "content": msg.content})
    # await msg.update()
  

@cl.set_starters
async def set_starters():
    return [
        cl.Starter(
            label="List my projects",
            message="List all upsun project.",
            icon="/public/idea.svg",
            )
        ]

@cl.on_chat_start
def start_chat():
    cl.user_session.set(
        "message_history",
        [{"role": "system", "content": "You are a helpful assistant."}],
    )

@cl.on_mcp_connect
async def on_mcp_connect(connection, session: ClientSession):
    """Called when an MCP connection is established"""
    # Your connection initialization code here
    # This handler is required for MCP to work
    
@cl.on_mcp_disconnect
async def on_mcp_disconnect(name: str, session: ClientSession):
    """Called when an MCP connection is terminated"""
    # Your cleanup code here
    # This handler is optional

# async def call_model_with_tools():
#     # Get tools from all MCP connections
#     mcp_tools = cl.user_session.get("mcp_tools", {})
#     all_tools = [tool for connection_tools in mcp_tools.values() for tool in connection_tools]
    
#     # Call your LLM with the tools
#     response = await your_llm_client.call(
#         messages=messages,
#         tools=all_tools
#     )
    
#     # Handle tool calls if needed
#     if response.has_tool_calls():
#         # Process tool calls
#         pass
        
#     return response