import { Brain, ChevronDown } from "lucide-react";
import { type FC, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ReasoningRendererProps } from "@/types/renderer";
import MarkdownRenderer from "./markdown-renderer";

const ReasoningRenderer: FC<ReasoningRendererProps> = ({
  content,
  isComplete,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const hasContent = content && content.trim().length > 0;

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
          hasContent && "cursor-pointer",
        )}
        disabled={!hasContent}
      >
        <div className="flex items-center gap-2 text-foreground">
          {isComplete ? (
            <Brain className="size-5" />
          ) : (
            <Spinner className="size-5" />
          )}
          <p className="text-base leading-5">
            {isComplete
              ? t("chat.reasoning.completed")
              : t("chat.reasoning.thinking")}
          </p>
        </div>
        {hasContent && (
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
        <div className="pt-2">
          {hasContent && (
            <MarkdownRenderer
              content={content}
              className="text-muted-foreground text-xs leading-5"
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default memo(ReasoningRenderer);
