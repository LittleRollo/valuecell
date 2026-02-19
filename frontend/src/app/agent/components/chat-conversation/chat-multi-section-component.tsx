import { parse } from "best-effort-json-parser";
import { type FC, memo } from "react";
import { useTranslation } from "react-i18next";
import BackButton from "@/components/valuecell/button/back-button";
import { MarkdownRenderer } from "@/components/valuecell/renderer";
import { useMultiSection } from "@/provider/multi-section-provider";
import type { MultiSectionComponentType } from "@/types/agent";

// define different component types and their specific rendering components
const ReportComponent: FC<{ content: string }> = ({ content }) => {
  const { t } = useTranslation();
  const { closeSection } = useMultiSection();
  const { title, data } = parse(content);
  const displayTitle = title || t("chat.report.defaultTitle");
  const displayData = data || content;

  return (
    <>
      <header className="mb-3 flex items-center gap-2">
        <BackButton onClick={closeSection} />
        <h4 className="font-semibold text-lg">{displayTitle}</h4>
      </header>
      <div className="scroll-container h-[calc(100vh-160px)] rounded-xl border border-border bg-card p-5">
        <MarkdownRenderer content={displayData} />
      </div>
    </>
  );
};

const MULTI_SECTION_COMPONENT_MAP: Record<
  MultiSectionComponentType,
  FC<{ content: string }>
> = {
  report: ReportComponent,
};

interface ChatMultiSectionComponentProps {
  componentType: MultiSectionComponentType;
  content: string;
}

const ChatMultiSectionComponent: FC<ChatMultiSectionComponentProps> = ({
  componentType,
  content,
}) => {
  const Component = MULTI_SECTION_COMPONENT_MAP[componentType];
  return <Component content={content} />;
};

export default memo(ChatMultiSectionComponent);
