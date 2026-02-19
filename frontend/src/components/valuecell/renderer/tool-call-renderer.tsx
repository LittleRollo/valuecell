import { parse } from "best-effort-json-parser";
import { ChevronDown, Search } from "lucide-react";
import { type FC, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ToolCallRendererProps } from "@/types/renderer";
import MarkdownRenderer from "./markdown-renderer";

const WEB_SEARCH_PROCESS_MARKERS = [
  "该用户询问了",
  "我用web_search工具",
  "工具的回复包含",
  "我现在需要按照说明",
  "首先，检查关键输出规则",
  "看工具回复",
  "让我逐一解析",
  "让我看看",
];

function sanitizeWebSearchToolContent(
  toolName: string | undefined,
  rawContent: string,
): string {
  if (toolName !== "web_search") return rawContent;

  const content = (rawContent || "").trim();
  if (!content) return rawContent;

  const hasProcessIntro = WEB_SEARCH_PROCESS_MARKERS.some((marker) =>
    content.includes(marker),
  );
  if (!hasProcessIntro) return rawContent;

  const lines = content.split("\n");
  const bodyStartIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    return (
      /^\d+[\.、\)]\s*/.test(trimmed) ||
      /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/.test(trimmed) ||
      /^[-*]\s+/.test(trimmed) ||
      /^#{1,3}\s+/.test(trimmed) ||
      /^\*\*[^*]{4,}\*\*/.test(trimmed) ||
      /^https?:\/\//i.test(trimmed)
    );
  });

  if (bodyStartIndex <= 0) return rawContent;

  return lines.slice(bodyStartIndex).join("\n").trim();
}

const ToolCallRenderer: FC<ToolCallRendererProps> = ({ content }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { tool_name, tool_result, step_label } = parse(content);
  const tool_result_array = parse(tool_result);
  const hasResult = !!tool_result;

  const stepTitle = tool_name || t("chat.tool.unknownTool");
  const stepLabel = step_label || t("chat.tool.step");

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("min-w-96 rounded-xl border-gradient bg-card p-3")}
      data-active={isOpen}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between",
          hasResult && "cursor-pointer",
        )}
        disabled={!hasResult}
      >
        <div className="flex min-w-0 items-center gap-2 text-foreground">
          {hasResult ? (
            <Search className="size-5" />
          ) : (
            <Spinner className="size-5" />
          )}
          <div className="flex min-w-0 flex-col items-start">
            <p className="font-medium text-muted-foreground text-sm leading-4">
              {stepLabel}
            </p>
            <p className="truncate text-base leading-5">{stepTitle}</p>
          </div>
        </div>
        {hasResult && (
          <ChevronDown
            className={cn(
              "h-6 w-6 text-muted-foreground transition-transform",
              isOpen && "rotate-180",
            )}
          />
        )}
      </CollapsibleTrigger>

      {/* Collapsible Content */}
      <CollapsibleContent>
        <div className="scroll-container max-h-56 space-y-3 pt-3">
          {tool_result_array &&
            Array.isArray(tool_result_array) &&
            // TODO: temporarily use content as result type, need to improve later
            // biome-ignore lint/suspicious/noExplicitAny: temporarily use any as result type
            tool_result_array?.map((tool_result: any, index: number) => {
              return tool_result.content ? (
                <MarkdownRenderer
                  className="text-muted-foreground text-xs leading-5"
                  content={sanitizeWebSearchToolContent(
                    tool_name,
                    String(tool_result.content),
                  )}
                  key={`${index}-${String(tool_result.content).slice(0, 24)}`}
                />
              ) : (
                <p className="text-muted-foreground text-xs" key={`${index}-${String(tool_result)}`}>
                  {String(tool_result)}
                </p>
              );
            })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default memo(ToolCallRenderer);
