import { type FC, memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { MarkdownRendererProps } from "@/types/renderer";

const MarkdownRenderer: FC<MarkdownRendererProps> = ({
  content,
  className,
}) => {
  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none text-sm leading-6",
        "prose-headings:text-foreground prose-li:text-foreground prose-p:text-foreground",
        "prose-blockquote:text-muted-foreground prose-strong:text-foreground",
        "prose-a:text-sky-600 dark:prose-a:text-sky-300",
        "prose-table:my-4 prose-table:w-full",
        "prose-thead:border-border prose-thead:border-b",
        "prose-th:px-2 prose-th:py-2 prose-th:text-left prose-th:text-xs",
        "prose-td:border-border prose-td:border-b prose-td:px-2 prose-td:py-2",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
        "prose-pre:border prose-pre:border-border prose-pre:bg-muted",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default memo(MarkdownRenderer);
