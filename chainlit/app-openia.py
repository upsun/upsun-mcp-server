from pprint import pprint
from openai import AsyncOpenAI
from mcp import ClientSession
from chainlit.logger import logger

import json
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
    logger.info('Received message:')

    messages = [
        {"role": "system", "content": "You are a helpful assistant to help me manage upsun projects. use the tools to help you. convert json content on enumeration value"},
        {"role": "user", "content": message.content},
    ]

    response = await call_model_with_tools(messages)

    while response.stop_reason == "tool_use":
        tool_use = next(block for block in response.content if block.type == "tool_use")
        tool_result = await call_tool(tool_use)

        messages = [
            {"role": "assistant", "content": response.content},
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": str(tool_result),
                    }
                ],
            },
        ]

        #chat_messages.extend(messages)
        response = await call_model_with_tools(messages)
    # if isinstance(response, list):
    #     # tool_results = await handle_tool_calls(response)
    #     for tool_call in response:
    #         if tool_call.type == "function":
    #             tool_name = tool_call.function.name
    #             tool_input = json.loads(tool_call.function.arguments)
    #             tool_use = type('', (object,), {"name": tool_name, "input": tool_input})()

    #             tool_results = await call_tool(tool_use)
    #             await cl.Message(content=str(tool_results)).send()
    # else:
    #     await cl.Message(content=response).send()

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
    logger.info('Starters called')
    return [
        cl.Starter(
            label="List my projects",
            message="List all upsun project.",
            icon="/public/idea.svg",
            )
        ]


@cl.on_chat_start
def start_chat():
    logger.info('Start chat called')
    cl.user_session.set(
        "message_history",
        [{"role": "system", "content": "You are a helpful assistant."}],
    )


@cl.on_mcp_connect
async def on_mcp_connect(connection, session: ClientSession):
    """Called when an MCP connection is established"""
    logger.info('MCP connection established')

    cl.user_session.set("connection", connection)
    cl.user_session.set("session", session)

    # List available tools
    result = await session.list_tools()

    # Process tool metadata
    tools = [{
        "name": t.name,
        "description": t.description,
        "input_schema": t.inputSchema,
    } for t in result.tools]

    # Store tools for later use
    mcp_tools = cl.user_session.get("mcp_tools", {})
    mcp_tools[connection.name] = tools
    cl.user_session.set("mcp_tools", mcp_tools)


@cl.on_mcp_disconnect
async def on_mcp_disconnect(name: str, session: ClientSession):
    """Called when an MCP connection is terminated"""
    logger.info('MCP disconected')
    # Your cleanup code here
    # This handler is optional


async def call_model_with_tools(messages):
    mcp_tools = cl.user_session.get("mcp_tools", {})
    all_tools = [tool for connection_tools in mcp_tools.values() for tool in connection_tools]

    response = await client.chat.completions.create(
        messages=messages,
        tools=[{
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"],
            }
        } for tool in all_tools],
        **settings
    )

    choice = response.choices[0]

    if response.has_tool_calls():
        logger.info('tool_calls finded')
        tool_calls = choice.message.tool_calls
        return tool_calls
    else:
        logger.info('returning message')
        return choice.message.content


@cl.step(type="tool")
async def call_tool(tool_use):
    logger.info('call_tool called')

    tool_name = tool_use.name
    tool_input = tool_use.input

    mcp_name = find_mcp_for_tool(tool_name)
    mcp_session, _ = cl.context.session.mcp_sessions.get(mcp_name)

    if mcp_session:
        result = await mcp_session.call_tool(tool_name, tool_input)
        return result
    else:
        raise ValueError(f"Aucune session MCP trouvée pour l'outil : {tool_name}")


def find_mcp_for_tool(tool_name):
    logger.info('find_mcp_for_tool called')
    mcp_tools = cl.user_session.get("mcp_tools", {})
    for mcp_name, tools in mcp_tools.items():
        if any(tool["name"] == tool_name for tool in tools):
            return mcp_name
    raise ValueError(f"Tool {tool_name} not found in any MCP connection.")


# async def handle_tool_calls(tool_calls):
#     logger.info('handle_tool_calls called')
#     session = cl.user_session.get("session")

#     results = []
#     for call in tool_calls:
#         pprint(vars(call))
#         result = await session.invoke_tool(
#             call.function.name,
#             call.function.arguments
#         )
#         results.append(result)
#     return results

if __name__ == "__main__":
    from chainlit.cli import run_chainlit
    run_chainlit(__file__)
