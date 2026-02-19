import { create } from "mutative";
import { AGENT_SECTION_COMPONENT_TYPE } from "@/constants/agent";
import type {
  AgentConversationsStore,
  ChatItem,
  ConversationView,
  SectionComponentType,
  SSEData,
  TaskView,
  ThreadView,
} from "@/types/agent";

const ANALYSIS_STEP_TITLES = [
  "构建分析策略任务规划",
  "基本面与财务健康度调研",
  "基本面与股基本面分析",
  "多周期技术形态与筹码分布研究",
  "市场情绪与资金动态监控",
  "实时资讯与重大事项搜寻",
] as const;

const ANALYSIS_OVERFLOW_STEP_TITLE = "构建分析策略";

const NEWS_STEP_TITLES = [
  "检索今日全球科技重大新闻",
  "检索今日国内科技行业及 A 股科技板块动态",
  "分析科技行业市场情绪与资金流向",
] as const;

type StepTemplateType = "analysis" | "news";

const STEP_TEMPLATE_START_TITLES = [ANALYSIS_STEP_TITLES[0], NEWS_STEP_TITLES[0]];

const NEWS_QUERY_MARKER_REGEX = /新闻|快讯|头条|今日科技|科技新闻|财经新闻|实时资讯/i;

function extractCompanyNameFromText(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;

  const withCodeMatch = normalized.match(
    /([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9·\-\s]{1,30}?)\s*[（(]\s*\d{4,6}\s*[)）]/,
  );
  if (withCodeMatch?.[1]) {
    return withCodeMatch[1].trim();
  }

  const companySuffixMatch = normalized.match(
    /([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9·\-\s]{1,30}?(?:股份有限公司|有限公司|集团|控股|科技|实业|银行|证券|制药|能源|汽车|传媒))/,
  );
  if (companySuffixMatch?.[1]) {
    return companySuffixMatch[1].trim();
  }

  return null;
}

function getThreadItems(thread: ThreadView): ChatItem[] {
  return Object.values(thread.tasks).flatMap((task) => task.items);
}

function isPlanningAnchorTool(item: ChatItem): boolean {
  if (item.component_type !== "tool_call" || !hasContent(item)) {
    return false;
  }

  try {
    const parsed = JSON.parse(item.payload.content) as {
      tool_name?: string;
      step_label?: string;
    };
    return (
      parsed.tool_name === "generate_execution_plan" ||
      STEP_TEMPLATE_START_TITLES.includes(parsed.step_label ?? "")
    );
  } catch {
    return false;
  }
}

function detectStepTemplateInThread(thread: ThreadView): StepTemplateType {
  const userContents = getThreadItems(thread)
    .filter((item) => item.role === "user" && hasContent(item))
    .map((item) => item.payload.content);

  if (userContents.some((content) => NEWS_QUERY_MARKER_REGEX.test(content))) {
    return "news";
  }

  const planningToolItems = getPlanningToolItems(thread);
  const planningToolNames = planningToolItems
    .map(getToolNameFromItem)
    .filter((name): name is string => Boolean(name));

  const hasNewsTool = planningToolNames.some((name) =>
    ["web_search", "get_breaking_news", "get_financial_news"].includes(name),
  );
  const hasResearchTool = planningToolNames.some((name) =>
    ["fetch_ashare_filings", "fetch_us_filing_sections"].includes(name),
  );

  if (hasNewsTool && !hasResearchTool) {
    return "news";
  }

  return "analysis";
}

function getPlanningToolItems(thread: ThreadView): ChatItem[] {
  const allToolItems = getThreadItems(thread).filter(
    (item) => item.component_type === "tool_call",
  );

  let anchorIndex = -1;
  for (let i = allToolItems.length - 1; i >= 0; i--) {
    if (isPlanningAnchorTool(allToolItems[i])) {
      anchorIndex = i;
      break;
    }
  }

  return anchorIndex >= 0 ? allToolItems.slice(anchorIndex) : [];
}

function detectCompanyNameInThread(
  thread: ThreadView,
  fallbackTaskTitle?: string,
): string | null {
  const userContents = getThreadItems(thread)
    .filter((item) => item.role === "user" && hasContent(item))
    .map((item) => item.payload.content);

  for (const content of userContents) {
    const candidate = extractCompanyNameFromText(content);
    if (candidate) {
      return candidate;
    }
  }

  if (fallbackTaskTitle) {
    return extractCompanyNameFromText(fallbackTaskTitle);
  }

  return null;
}

function getToolStepOrderInThread(
  thread: ThreadView,
  itemId: string,
  currentToolName?: string,
): number {
  const threadToolItems = getPlanningToolItems(thread);

  if (threadToolItems.length === 0) {
    if (currentToolName === "generate_execution_plan") {
      return 1;
    }
    return 0;
  }

  const existingIndex = threadToolItems.findIndex(
    (item) => item.component_type === "tool_call" && item.item_id === itemId,
  );
  if (existingIndex >= 0) {
    return existingIndex + 1;
  }

  const existingToolCount = threadToolItems.length;
  return existingToolCount + 1;
}

function buildPlannedStepLabel(
  stepOrder: number,
  companyName: string | null,
  templateType: StepTemplateType,
): string | null {
  const templateTitles =
    templateType === "news" ? NEWS_STEP_TITLES : ANALYSIS_STEP_TITLES;
  const baseTitle =
    templateTitles[stepOrder - 1] ??
    (templateType === "analysis" ? ANALYSIS_OVERFLOW_STEP_TITLE : null);
  if (!baseTitle) {
    return null;
  }

  if (templateType === "analysis" && stepOrder >= 2 && companyName) {
    return `${baseTitle}（${companyName}）`;
  }

  return baseTitle;
}

function getToolNameFromItem(item: ChatItem): string | null {
  if (item.component_type !== "tool_call" || !hasContent(item)) {
    return null;
  }

  try {
    const parsed = JSON.parse(item.payload.content) as { tool_name?: string };
    return parsed.tool_name ?? null;
  } catch {
    return null;
  }
}

function getStepLabelFromItem(item: ChatItem): string | null {
  if (item.component_type !== "tool_call" || !hasContent(item)) {
    return null;
  }

  try {
    const parsed = JSON.parse(item.payload.content) as { step_label?: string };
    return parsed.step_label ?? null;
  } catch {
    return null;
  }
}

function shouldApplyAnalysisStepTemplate(
  thread: ThreadView,
  currentToolName: string | undefined,
): boolean {
  if (currentToolName === "generate_execution_plan") {
    return true;
  }

  const planningItems = getPlanningToolItems(thread);
  const firstToolItem = planningItems[0];
  if (!firstToolItem) {
    return false;
  }

  const firstToolName = getToolNameFromItem(firstToolItem);
  const firstStepLabel = getStepLabelFromItem(firstToolItem);
  return (
    firstToolName === "generate_execution_plan" ||
    STEP_TEMPLATE_START_TITLES.includes(firstToolName ?? "") ||
    STEP_TEMPLATE_START_TITLES.includes(firstStepLabel ?? "")
  );
}

// Unified helper to ensure conversation->thread->task path exists
function ensurePath(
  draft: AgentConversationsStore,
  data: {
    conversation_id: string;
    thread_id: string;
    task_id: string;
  },
): {
  conversation: ConversationView;
  thread: ThreadView;
  task: TaskView;
} {
  // Ensure conversation with sections initialized
  draft[data.conversation_id] ??= {
    threads: {},
    sections: {} as Record<SectionComponentType, ThreadView>,
  };
  const conversation = draft[data.conversation_id];

  // Ensure thread
  conversation.threads[data.thread_id] ??= { tasks: {} };
  const thread = conversation.threads[data.thread_id];

  // Ensure task
  thread.tasks[data.task_id] ??= { items: [] };
  const task = thread.tasks[data.task_id];

  return { conversation, thread, task };
}

// Helper to ensure section->task path exists
function ensureSection(
  conversation: ConversationView,
  componentType: SectionComponentType,
  taskId: string,
): TaskView {
  conversation.sections[componentType] ??= { tasks: {} };
  conversation.sections[componentType].tasks[taskId] ??= { items: [] };

  return conversation.sections[componentType].tasks[taskId];
}

// Check if item has mergeable content
function hasContent(
  item: ChatItem,
): item is ChatItem & { payload: { content: string } } {
  return "payload" in item && "content" in item.payload;
}

// Mark a specific reasoning item as complete
function markReasoningComplete(task: TaskView, itemId: string): void {
  const existingIndex = task.items.findIndex((item) => item.item_id === itemId);
  if (existingIndex >= 0 && hasContent(task.items[existingIndex])) {
    try {
      const parsed = JSON.parse(task.items[existingIndex].payload.content);
      task.items[existingIndex].payload.content = JSON.stringify({
        ...parsed,
        isComplete: true,
      });
    } catch {
      // If parsing fails, just mark as complete
      task.items[existingIndex].payload.content = JSON.stringify({
        content: task.items[existingIndex].payload.content,
        isComplete: true,
      });
    }
  }
}

// Mark all reasoning items in a task as complete
function markAllReasoningComplete(task: TaskView): void {
  for (const item of task.items) {
    if (item.component_type === "reasoning" && hasContent(item)) {
      try {
        const parsed = JSON.parse(item.payload.content);
        if (!parsed.isComplete) {
          item.payload.content = JSON.stringify({
            ...parsed,
            isComplete: true,
          });
        }
      } catch {
        // Skip items that can't be parsed
      }
    }
  }
}

// Helper function: add or update item in task
function addOrUpdateItem(
  task: TaskView,
  newItem: ChatItem,
  event: "append" | "replace" | "append-reasoning",
): void {
  const existingIndex = task.items.findIndex(
    (item) => item.item_id === newItem.item_id,
  );

  if (existingIndex < 0) {
    task.items.push(newItem);
    return;
  }

  const existingItem = task.items[existingIndex];
  // Merge content for streaming events, replace for others
  if (event === "append" && hasContent(existingItem) && hasContent(newItem)) {
    existingItem.payload.content += newItem.payload.content;
  } else if (
    event === "append-reasoning" &&
    hasContent(existingItem) &&
    hasContent(newItem)
  ) {
    // Special handling for reasoning: parse JSON, append content, re-serialize
    try {
      const existingParsed = JSON.parse(existingItem.payload.content);
      const newParsed = JSON.parse(newItem.payload.content);
      existingItem.payload.content = JSON.stringify({
        content: (existingParsed.content ?? "") + (newParsed.content ?? ""),
        isComplete: newParsed.isComplete ?? false,
      });
    } catch {
      // Fallback to replace if parsing fails
      task.items[existingIndex] = newItem;
    }
  } else {
    task.items[existingIndex] = newItem;
  }
}

// Generic handler for events that create chat items
function handleChatItemEvent(
  draft: AgentConversationsStore,
  data: ChatItem,
  event: "append" | "replace" | "append-reasoning" = "append",
) {
  const { conversation, task } = ensurePath(draft, data);

  // Auto-maintain sections - only non-markdown types create independent sections
  const componentType = data.component_type;
  if (
    componentType &&
    AGENT_SECTION_COMPONENT_TYPE.includes(componentType as SectionComponentType)
  ) {
    const sectionTask = ensureSection(
      conversation,
      componentType as SectionComponentType,
      data.task_id,
    );
    addOrUpdateItem(sectionTask, data, event);
    return;
  }

  addOrUpdateItem(task, data, event);
}

// Core event processor - processes a single SSE event
function processSSEEvent(draft: AgentConversationsStore, sseData: SSEData) {
  const { event, data } = sseData;

  switch (event) {
    // component_generator preserves original component_type
    case "component_generator": {
      const component_type = data.payload.component_type;

      switch (component_type) {
        case "scheduled_task_result":
        case "subagent_conversation":
          handleChatItemEvent(
            draft,
            {
              ...data,
              component_type,
            },
            "replace",
          );
          break;
        default:
          handleChatItemEvent(draft, {
            ...data,
            component_type,
          });
          break;
      }
      break;
    }

    case "thread_started":
    case "message_chunk":
    case "message":
    case "task_failed":
    case "plan_failed":
    case "plan_require_user_input":
      // Other events are set as markdown type
      handleChatItemEvent(draft, { component_type: "markdown", ...data });
      break;

    case "reasoning":
      // Reasoning is streaming content that needs to be appended (like message_chunk)
      handleChatItemEvent(
        draft,
        {
          component_type: "reasoning",
          ...data,
          payload: {
            content: JSON.stringify({
              content: data.payload.content,
              isComplete: false,
            }),
          },
        },
        "append-reasoning",
      );
      break;

    case "reasoning_started":
      // Create initial reasoning item with empty content
      handleChatItemEvent(
        draft,
        {
          component_type: "reasoning",
          ...data,
          payload: {
            content: JSON.stringify({
              content: "",
              isComplete: false,
            }),
          },
        },
        "replace",
      );
      break;

    case "reasoning_completed": {
      // Mark reasoning as complete
      const { task } = ensurePath(draft, data);
      markReasoningComplete(task, data.item_id);
      break;
    }

    case "tool_call_started":
    case "tool_call_completed": {
      const { thread } = ensurePath(draft, data);
      const templateType = detectStepTemplateInThread(thread);
      const shouldApplyTemplate = shouldApplyAnalysisStepTemplate(
        thread,
        data.payload.tool_name,
      );
      const stepOrder = getToolStepOrderInThread(
        thread,
        data.item_id,
        data.payload.tool_name,
      );
      const companyName = detectCompanyNameInThread(thread, data.metadata?.task_title);
      const plannedStepLabel = shouldApplyTemplate
        ? buildPlannedStepLabel(stepOrder, companyName, templateType)
        : null;

      handleChatItemEvent(
        draft,
        {
          component_type: "tool_call",
          ...data,
          payload: {
            content: JSON.stringify({
              ...data.payload,
              step_label: plannedStepLabel,
            }),
          },
        },
        "replace",
      );
      break;
    }

    default:
      break;
  }
}

export function updateAgentConversationsStore(
  store: AgentConversationsStore,
  sseData: SSEData,
) {
  // Use mutative to create new state with type-safe event handling
  return create(store, (draft) => {
    processSSEEvent(draft, sseData);
  });
}

/**
 * Batch update agent conversations store with multiple SSE events
 * @param store - Current agent conversations store
 * @param conversationId - The conversation ID to clear and update
 * @param sseDataList - Array of SSE events to process
 * @returns Updated store with all events processed atomically
 */
export function batchUpdateAgentConversationsStore(
  store: AgentConversationsStore,
  conversationId: string,
  sseDataList: SSEData[],
  clearHistory = false,
) {
  // Process all events in a single mutative transaction for better performance
  return create(store, (draft) => {
    // Clear existing data for this conversation
    if (clearHistory && draft[conversationId]) {
      delete draft[conversationId];
    }

    // Process all new events
    for (const sseData of sseDataList) {
      processSSEEvent(draft, sseData);
    }

    // Mark all reasoning items as complete after loading history
    // since the stream has already finished
    const conversation = draft[conversationId];
    if (conversation) {
      for (const thread of Object.values(conversation.threads)) {
        for (const task of Object.values(thread.tasks)) {
          markAllReasoningComplete(task);
        }
      }
    }
  });
}
