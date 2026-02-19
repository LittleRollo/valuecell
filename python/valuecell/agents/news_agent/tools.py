"""News-related tools for the News Agent."""

import os
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus
from xml.etree import ElementTree

import httpx
from agno.agent import Agent
from loguru import logger

from valuecell.adapters.models import create_model

SEARCH_PROVIDER_GOOGLE = "google"
SEARCH_PROVIDER_OPENROUTER = "openrouter"
SEARCH_PROVIDER_SILICONFLOW = "siliconflow"

SEARCH_UNAVAILABLE_MARKERS = (
    "无法直接联网检索实时新闻",
    "无法联网检索",
    "不能联网",
    "无法访问互联网",
    "cannot access real-time news",
    "can't access real-time news",
)


def _active_search_provider() -> str:
    provider = os.getenv("WEB_SEARCH_PROVIDER", "auto").strip().lower()
    return provider or "auto"


def _can_use_provider(provider: str) -> bool:
    if provider == SEARCH_PROVIDER_GOOGLE:
        return bool(os.getenv("GOOGLE_API_KEY"))
    if provider == SEARCH_PROVIDER_OPENROUTER:
        return bool(os.getenv("OPENROUTER_API_KEY"))
    if provider == SEARCH_PROVIDER_SILICONFLOW:
        return bool(os.getenv("SILICONFLOW_API_KEY"))
    return False


def _build_provider_order() -> list[str]:
    requested = _active_search_provider()
    all_providers = [
        SEARCH_PROVIDER_GOOGLE,
        SEARCH_PROVIDER_OPENROUTER,
        SEARCH_PROVIDER_SILICONFLOW,
    ]

    if requested in all_providers:
        return [requested, *[p for p in all_providers if p != requested]]

    return all_providers


def _build_search_unavailable_message(query: str) -> str:
    logger.warning("News web search unavailable for query: {}", query)
    return (
        "实时新闻检索服务暂不可用。"
        "请稍后重试，或切换可用的搜索模型提供商后再查询。"
    )


async def _web_search_google_news_rss(query: str, limit: int = 8) -> str:
    encoded_query = quote_plus(query)
    url = (
        "https://news.google.com/rss/search"
        f"?q={encoded_query}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
    )

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content = resp.text

    root = ElementTree.fromstring(content)
    items = root.findall("./channel/item")

    results: list[str] = []
    for item in items[:limit]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source = (item.findtext("source") or "").strip()

        if not title:
            continue

        line = f"**{title}**"
        meta_parts = []
        if source:
            meta_parts.append(source)
        if pub_date:
            meta_parts.append(pub_date)

        if meta_parts:
            line += f"\n{ ' | '.join(meta_parts) }"
        if link:
            line += f"\n{link}"

        results.append(line)

    if not results:
        return ""

    return "\n\n".join(results)


def _looks_like_unavailable_response(content: str) -> bool:
    normalized = (content or "").strip().lower()
    if not normalized:
        return True

    return any(marker.lower() in normalized for marker in SEARCH_UNAVAILABLE_MARKERS)


async def _run_agent_search(model, query: str) -> str:
    response = await Agent(model=model).arun(query)
    return response.content or ""


async def web_search(query: str) -> str:
    """Search web for the given query and return a summary of the top results.

    This function uses the centralized configuration system to create model instances.
    It supports multiple search providers:
    - Google (Gemini with search enabled) - when WEB_SEARCH_PROVIDER=google and GOOGLE_API_KEY is set
    - Perplexity (via OpenRouter) - default fallback

    Args:
        query: The search query string.

    Returns:
        A summary of the top search results.
    """
    try:
        rss_content = await _web_search_google_news_rss(query)
        if not _looks_like_unavailable_response(rss_content):
            logger.info("News search served via Google News RSS")
            return rss_content
    except Exception as exc:
        logger.warning("Google News RSS search failed: {}", exc)

    for provider in _build_provider_order():
        if not _can_use_provider(provider):
            continue

        try:
            if provider == SEARCH_PROVIDER_GOOGLE:
                content = await _web_search_google(query)
                if not _looks_like_unavailable_response(content):
                    return content
            if provider == SEARCH_PROVIDER_OPENROUTER:
                content = await _web_search_openrouter(query)
                if not _looks_like_unavailable_response(content):
                    return content
            if provider == SEARCH_PROVIDER_SILICONFLOW:
                content = await _web_search_siliconflow(query)
                if not _looks_like_unavailable_response(content):
                    return content
        except Exception as exc:
            logger.warning("{} web search failed: {}", provider, exc)

    return _build_search_unavailable_message(query)


async def _web_search_google(query: str) -> str:
    """Search Google for the given query and return a summary of the top results.

    Uses Google Gemini with search grounding enabled for real-time web information.

    Args:
        query: The search query string.

    Returns:
        A summary of the top search results.
    """
    # Use Google Gemini with search enabled
    # The search=True parameter enables Google Search grounding for real-time information
    model = create_model(
        provider="google",
        model_id="gemini-2.5-flash",
        search=True,  # Enable Google Search grounding
    )
    return await _run_agent_search(model, query)


async def _web_search_openrouter(query: str) -> str:
    model = create_model(
        provider="openrouter",
        model_id="perplexity/sonar",
        max_tokens=None,
    )
    return await _run_agent_search(model, query)


async def _web_search_siliconflow(query: str) -> str:
    model = create_model(provider="siliconflow")
    enhanced_query = (
        "请基于可获取的公开信息给出最新新闻摘要；"
        "如果当前无法联网检索，请明确说明并返回最小可用结论。\n\n"
        f"查询: {query}"
    )
    return await _run_agent_search(model, enhanced_query)


async def get_breaking_news() -> str:
    """Get breaking news and urgent updates.

    Returns:
        Formatted string containing breaking news
    """
    try:
        search_query = "breaking news urgent updates today"
        logger.info("Fetching breaking news")

        news_content = await web_search(search_query)
        return news_content

    except Exception as exc:
        logger.error("Error fetching breaking news: {}", exc)
        return "暂时无法获取突发新闻，请稍后重试。"


async def get_financial_news(
    ticker: Optional[str] = None, sector: Optional[str] = None
) -> str:
    """Get financial and market news.

    Args:
        ticker: Stock ticker symbol for company-specific news
        sector: Industry sector for sector-specific news

    Returns:
        Formatted string containing financial news
    """
    try:
        search_query = "financial market news"

        if ticker:
            search_query = f"{ticker} stock news financial market"
        elif sector:
            search_query = f"{sector} sector financial news market"

        # Add time constraint for recent news
        today = datetime.now().strftime("%Y-%m-%d")
        search_query += f" {today}"

        logger.info(f"Searching for financial news with query: {search_query}")

        news_content = await web_search(search_query)
        return news_content

    except Exception as exc:
        logger.error("Error fetching financial news: {}", exc)
        return "暂时无法获取财经新闻，请稍后重试。"
