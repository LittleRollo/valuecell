import { parse } from "best-effort-json-parser";
import { ChevronRight, FileText } from "lucide-react";
import { type FC, memo } from "react";
import { useTranslation } from "react-i18next";
import { TIME_FORMATS, TimeUtils } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ReportRendererProps } from "@/types/renderer";

const ReportRenderer: FC<ReportRendererProps> = ({
  content,
  onOpen,
  isActive,
}) => {
  const { t } = useTranslation();
  const { title, create_time, data } = parse(content);
  const displayTitle = title || t("chat.report.defaultTitle");
  const reportDate = create_time
    ? TimeUtils.formatUTC(create_time, TIME_FORMATS.DATE)
    : "-";
  const reportContent = data || content;

  return (
    <div
      data-active={isActive}
      className={cn(
        "flex h-full min-w-96 items-center justify-between gap-3 rounded-xl px-4 py-5",
        "cursor-pointer border-gradient bg-card transition-all duration-200",
      )}
      onClick={() => onOpen?.(reportContent)}
    >
      {/* Left side: Icon and text */}
      <div className="flex items-center gap-2">
        {/* Document icon with background */}
        <div className="brand-gradient-bg flex size-10 items-center justify-center rounded-xl">
          <FileText className="size-6 text-white" />
        </div>

        {/* Text content */}
        <div className="flex flex-col gap-1">
          <p className="font-medium text-muted-foreground text-xs leading-4">
            {t("chat.report.label")}
          </p>
          <p className="font-semibold text-base text-foreground leading-5">
            {displayTitle}
          </p>
          <p className="text-muted-foreground text-xs leading-4">
            {`${t("chat.report.createdAt")}: ${reportDate}`}
          </p>
          <p className="text-primary text-xs leading-4">
            {t("chat.report.openHint")}
          </p>
        </div>
      </div>

      {/* Right side: Arrow icon */}
      <ChevronRight className="size-6 text-muted-foreground" />
    </div>
  );
};

export default memo(ReportRenderer);
