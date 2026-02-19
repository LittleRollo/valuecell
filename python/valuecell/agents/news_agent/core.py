"""News Agent Core Implementation."""

import re
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, Optional

from agno.agent import Agent
from loguru import logger

from valuecell.adapters.models import create_model_for_agent
from valuecell.config.manager import get_config_manager
from valuecell.core.agent.responses import streaming
from valuecell.core.types import BaseAgent, StreamResponse

from .prompts import NEWS_AGENT_INSTRUCTIONS
from .tools import get_breaking_news, get_financial_news, web_search

STRONG_PROCESS_INTRO_MARKERS = (
    "该用户询问了",
    "我用web_search工具",
    "工具的回复包含",
    "我现在需要按照说明",
    "首先，检查关键输出规则",
    "看工具回复",
    "让我逐一解析",
    "让我看看",
)


def _looks_like_news_body_start(line: str) -> bool:
    trimmed = line.strip()
    if not trimmed:
        return False

    return bool(
        re.match(r"^\d+[\.、\)]\s*", trimmed)
        or re.match(r"^[①②③④⑤⑥⑦⑧⑨⑩]\s*", trimmed)
        or re.match(r"^[-*]\s+", trimmed)
        or re.match(r"^#{1,3}\s+", trimmed)
        or re.match(r"^\*\*[^*]{4,}\*\*", trimmed)
        or "http://" in trimmed
        or "https://" in trimmed
    )


def _sanitize_news_output(content: str) -> str:
    text = (content or "").strip()
    if not text:
        return ""

    prefix_probe = text[:1200]
    has_process_intro = any(marker in prefix_probe for marker in STRONG_PROCESS_INTRO_MARKERS)
    if not has_process_intro:
        return text

    lines = text.splitlines()
    start_idx = next(
        (idx for idx, line in enumerate(lines) if _looks_like_news_body_start(line)),
        -1,
    )

    if start_idx <= 0:
        return text

    sanitized = "\n".join(lines[start_idx:]).strip()
    return sanitized or text


def _has_heading(content: str) -> bool:
    first_non_empty = next((line.strip() for line in content.splitlines() if line.strip()), "")
    return bool(first_non_empty and (first_non_empty.startswith("#") or first_non_empty.startswith("**")))


def _build_news_heading(query: str) -> str:
    now = datetime.now()
    if "科技" in query:
        return f"## {now.year}年{now.month}月全球科技行业双循环格局与A股硬科技龙头价值重估"
    return f"## {now.year}年{now.month}月实时新闻速览"


def _format_news_output(content: str, query: str) -> str:
    cleaned = _sanitize_news_output(content)
    if not cleaned:
        return cleaned
    if _has_heading(cleaned):
        return cleaned
    heading = _build_news_heading(query)
    return f"{heading}\n\n{cleaned}".strip()


class NewsAgent(BaseAgent):
    """News Agent for fetching and analyzing news."""

    def __init__(self, **kwargs):
        """Initialize the News Agent."""
        super().__init__(**kwargs)
        # Load agent configuration
        self.config_manager = get_config_manager()
        self.agent_config = self.config_manager.get_agent_config("news_agent")

        # Load tools based on configuration
        available_tools = []

        available_tools.extend([web_search, get_breaking_news, get_financial_news])

        # Use create_model_for_agent to load agent-specific configuration
        self.knowledge_news_agent = Agent(
            model=create_model_for_agent("news_agent"),
            tools=available_tools,
            instructions=NEWS_AGENT_INSTRUCTIONS,
        )

        logger.info("NewsAgent initialized with news tools")

    async def stream(
        self,
        query: str,
        conversation_id: str,
        task_id: str,
        dependencies: Optional[Dict] = None,
    ) -> AsyncGenerator[StreamResponse, None]:
        """Stream news responses."""
        logger.info(
            f"Processing news query: {query[:100]}{'...' if len(query) > 100 else ''}"
        )

        try:
            has_final_content = False
            last_tool_result_text: str = ""
            final_content_chunks: list[str] = []

            response_stream = self.knowledge_news_agent.arun(
                query,
                stream=True,
                stream_intermediate_steps=True,
                session_id=conversation_id,
            )
            async for event in response_stream:
                if event.event == "RunContent":
                    has_final_content = True
                    final_content_chunks.append(str(event.content or ""))
                elif event.event == "ToolCallStarted":
                    yield streaming.tool_call_started(
                        event.tool.tool_call_id, event.tool.tool_name
                    )
                elif event.event == "ToolCallCompleted":
                    result = event.tool.result
                    if isinstance(result, str):
                        last_tool_result_text = result.strip()
                    elif result is None:
                        last_tool_result_text = ""
                    else:
                        last_tool_result_text = str(result).strip()

                    yield streaming.tool_call_completed(
                        event.tool.result, event.tool.tool_call_id, event.tool.tool_name
                    )

            if has_final_content:
                final_content = _format_news_output("".join(final_content_chunks), query)
                if final_content:
                    yield streaming.message_chunk(final_content)

            if (not has_final_content) and last_tool_result_text:
                yield streaming.message_chunk(
                    _format_news_output(last_tool_result_text, query)
                )

            yield streaming.done()
            logger.info("News query processed successfully")

        except Exception as e:
            logger.error(f"Error processing news query: {str(e)}")
            logger.exception("Full error details:")
            yield {"type": "error", "content": f"Error processing news query: {str(e)}"}

    async def run(self, query: str, **kwargs) -> str:
        """Run news agent and return response."""
        logger.info(
            f"Running news agent with query: {query[:100]}{'...' if len(query) > 100 else ''}"
        )

        try:
            logger.debug("Starting news agent processing")

            # Get the complete response from the knowledge news agent
            response = await self.knowledge_news_agent.arun(query)

            logger.info("News agent query completed successfully")
            logger.debug(f"Response length: {len(str(response.content))} characters")

            return _format_news_output(str(response.content or ""), query)

        except Exception as e:
            logger.error(f"Error in NewsAgent run: {e}")
            logger.exception("Full error details:")
            return f"Error processing news query: {str(e)}"

    def get_capabilities(self) -> Dict[str, Any]:
        """Get agent capabilities."""
        logger.debug("Retrieving news agent capabilities")

        capabilities = {
            "name": "News Agent",
            "description": "Professional news agent for fetching and analyzing news",
            "tools": [
                {
                    "name": "web_search",
                    "description": "Search for general news and information",
                },
                {
                    "name": "get_breaking_news",
                    "description": "Get latest breaking news",
                },
                {
                    "name": "get_financial_news",
                    "description": "Get financial and market news",
                },
            ],
            "supported_queries": [
                "Latest news",
                "Breaking news",
                "Financial news",
                "Market updates",
                "Topic-specific news search",
            ],
        }

        logger.debug("Capabilities retrieved successfully")
        return capabilities
