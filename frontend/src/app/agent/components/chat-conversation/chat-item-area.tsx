import { parse } from "best-effort-json-parser";
import { type FC, memo } from "react";
import { UnknownRenderer } from "@/components/valuecell/renderer";
import { COMPONENT_RENDERER_MAP } from "@/constants/agent";
import { cn } from "@/lib/utils";
import { useMultiSection } from "@/provider/multi-section-provider";
import type { ChatItem } from "@/types/agent";

export interface ChatItemAreaProps {
  items: ChatItem[];
}

const PROCESS_MARKDOWN_MARKERS = [
  "透明代理：",
  "透明代理:",
  "代理：",
  "代理:",
  "直通到指定代理",
  "通过通道给指定代理",
  "好，让我看看",
  "好的，我现在需要",
  "让我确认",
  "让我再",
  "人工智能在思考",
  "Wait,",
  "I should",
  "the user's query",
  "tool definitions",
  "parameters are optional",
  "so I should call",
];

const STRONG_PROCESS_INTRO_MARKERS = [
  "该用户询问了",
  "我用web_search工具",
  "工具的回复包含",
  "我现在需要按照说明",
  "首先，检查关键输出规则",
  "看工具回复",
  "让我逐一解析",
  "让我看看。",
];

const TOOL_DRAFT_MARKERS = [
  "可能需要调用",
  "首先，调用",
  "作为财务研究助理",
  "如果存在",
  "fetch_ashare_filings",
  "fetch_us_filing_sections",
  "web_search来搜索",
  "report_types=",
  "quarterly",
  "semi-annual",
];

const REPORT_TITLE_MARKERS = ["报告", "分析", "总结", "结论", "建议"];

const looksLikeSubstantiveMarkdown = (content: string): boolean => {
  const hasLink = /https?:\/\//i.test(content);
  const hasBulletList = /(^|\n)\s*(?:[-*]\s+|\d+\.\s+)/.test(content);
  const hasBoldHeadline = /\*\*[^*]{4,}\*\*/.test(content);
  const hasNewsMetaKeyword =
    /来源|source|发布|更新时间|UTC|GMT|CST|快讯|新闻/i.test(content);

  const isLongEnough = content.trim().length >= 120;

  return hasLink || (isLongEnough && hasBulletList) || (isLongEnough && hasBoldHeadline) || (isLongEnough && hasNewsMetaKeyword);
};

const looksLikeStrongProcessIntro = (content: string): boolean => {
  const normalized = content.replace(/\s+/g, "");
  return STRONG_PROCESS_INTRO_MARKERS.some((marker) =>
    normalized.includes(marker.replace(/\s+/g, "")),
  );
};

const looksLikeToolDraftMarkdown = (content: string): boolean => {
  const normalized = content.replace(/\s+/g, "");
  return TOOL_DRAFT_MARKERS.some((marker) =>
    normalized.includes(marker.replace(/\s+/g, "")),
  );
};

const getFirstMeaningfulLine = (content: string): string => {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
};

const looksLikeFinalReportMarkdown = (content: string): boolean => {
  const firstLine = getFirstMeaningfulLine(content);
  const hasHeading = /(^|\n)\s{0,3}#{1,3}\s+\S/.test(content);
  const hasSectionHeading =
    content.includes("\n## ") || /(^|\n)\s*[一二三四五六七八九十]+、/.test(content);
  const hasReportTitleNearTop =
    firstLine.length > 0 &&
    firstLine.length <= 80 &&
    REPORT_TITLE_MARKERS.some((marker) => firstLine.includes(marker));

  return hasHeading || hasSectionHeading || hasReportTitleNearTop;
};

const stripProcessPrefix = (content: string): string => {
  const lines = content.split("\n");
  const reportStartIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^#{1,3}\s+/.test(trimmed)) return true;
    if (/^[一二三四五六七八九十]+、/.test(trimmed)) return true;
    if (/^\d+[\.、\)]\s*/.test(trimmed)) return true;
    if (/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/.test(trimmed)) return true;
    if (/^[-*]\s+/.test(trimmed)) return true;
    if (/^\*\*[^*]{4,}\*\*$/.test(trimmed)) return true;
    return trimmed.length <= 80 && REPORT_TITLE_MARKERS.some((m) => trimmed.includes(m));
  });

  if (reportStartIndex <= 0) return content;

  const prefix = lines.slice(0, reportStartIndex).join("\n");
  const hasProcessSignalInPrefix =
    PROCESS_MARKDOWN_MARKERS.some((marker) => prefix.includes(marker)) ||
    /(让我|我来|先看|先检查|思考|分析步骤|工具回复)/.test(prefix);

  if (!hasProcessSignalInPrefix) {
    return content;
  }

  return lines.slice(reportStartIndex).join("\n").trim();
};

const ChatItemArea: FC<ChatItemAreaProps> = ({ items }) => {
  const { currentSection, openSection } = useMultiSection();

  // If no items, don't render anything
  if (!items || items.length === 0) return null;

  const hiddenProcessComponentTypes = new Set(["reasoning"]);

  const hasToolExecutionTrace = items.some(
    (item) =>
      item.component_type === "tool_call" || item.component_type === "reasoning",
  );

  const isProcessMarkdownItem = (item: ChatItem) => {
    if (item.component_type !== "markdown" || item.role === "user") {
      return false;
    }

    const content = item.payload?.content?.trim() ?? "";
    if (!content) return false;

    const looksLikeFinalReport = looksLikeFinalReportMarkdown(content);
    const looksLikeSubstantive = looksLikeSubstantiveMarkdown(content);

    if (looksLikeStrongProcessIntro(content)) {
      return true;
    }

    if (looksLikeToolDraftMarkdown(content)) {
      return true;
    }

    if (hasToolExecutionTrace && !looksLikeFinalReport && !looksLikeSubstantive) {
      return true;
    }

    if (looksLikeFinalReport || looksLikeSubstantive) return false;

    if (PROCESS_MARKDOWN_MARKERS.some((marker) => content.includes(marker))) {
      return true;
    }

    const normalizedContent = content.replace(/\s+/g, "");
    const looksLikeProxyRoutingNote =
      normalizedContent.length <= 120 &&
      normalizedContent.includes("代理") &&
      (normalizedContent.includes("直通") ||
        normalizedContent.includes("指定代理") ||
        normalizedContent.includes("通过通道"));

    return looksLikeProxyRoutingNote;
  };

  const isProcessItem = (item: ChatItem) => {
    if (hiddenProcessComponentTypes.has(item.component_type)) {
      return true;
    }

    if (isProcessMarkdownItem(item)) {
      return true;
    }

    return false;
  };

  const primaryItems = items.filter((item) => !isProcessItem(item));

  if (primaryItems.length === 0) return null;

  const renderItem = (item: ChatItem) => {
    const RendererComponent = COMPONENT_RENDERER_MAP[item.component_type];

    if (!item.payload) return null;
    switch (item.component_type) {
      case "markdown":
        return (
          <RendererComponent
            content={
              hasToolExecutionTrace
                ? stripProcessPrefix(item.payload.content)
                : item.payload.content
            }
          />
        );
      case "tool_call":
      case "subagent_conversation":
      case "scheduled_task_controller":
        return <RendererComponent content={item.payload.content} />;

      case "reasoning": {
        const parsed = parse(item.payload.content);
        return (
          <RendererComponent
            content={parsed?.content ?? ""}
            isComplete={parsed?.isComplete ?? false}
          />
        );
      }

      case "report":
        return (
          <RendererComponent
            content={item.payload.content}
            onOpen={() => openSection(item)}
            isActive={currentSection?.item_id === item.item_id}
          />
        );

      default:
        return <UnknownRenderer item={item} content={item.payload.content} />;
    }
  };

  const renderRow = (item: ChatItem) => (
    <div
      key={item.item_id}
      className={cn(
        "flex gap-4",
        item.role === "user" ? "justify-end" : "justify-start",
      )}
    >
      <div
        id="chat-item"
        className={cn(
          "max-w-[80%] rounded-2xl px-4 text-foreground dark:text-white",
          "dark:[&_a:hover]:text-sky-200 dark:[&_a]:text-sky-300 dark:[&_em]:text-white dark:[&_h1]:text-white dark:[&_h2]:text-white dark:[&_h3]:text-white dark:[&_h4]:text-white dark:[&_h5]:text-white dark:[&_h6]:text-white dark:[&_li]:text-white dark:[&_p]:text-white dark:[&_span]:text-white dark:[&_strong]:text-white",
          {
            "ml-auto bg-muted py-2.5": item.role === "user",
          },
        )}
      >
        {renderItem(item)}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {primaryItems.map(renderRow)}
    </div>
  );
};

export default memo(ChatItemArea);
