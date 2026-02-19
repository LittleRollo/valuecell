import { useTheme } from "next-themes";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateNewsSubscription,
  useDeleteNewsSubscription,
  useDeliverNewsSubscription,
  useGetHiddenAgents,
  useGetNewsSubscriptions,
} from "@/api/setting";
// import { useSignOut } from "@/api/system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTauriInfo } from "@/hooks/use-tauri-info";
import { useUpdateToast } from "@/hooks/use-update-toast";
import type { LanguageCode, StockColorMode } from "@/store/settings-store";
import {
  useLanguage,
  useSettingsActions,
  useStockColorMode,
} from "@/store/settings-store";
// import { useIsLoggedIn, useSystemInfo } from "@/store/system-store";

export default function GeneralPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const stockColorMode = useStockColorMode();
  const language = useLanguage();
  const { setStockColorMode, setLanguage } = useSettingsActions();
  const { checkAndUpdate } = useUpdateToast();
  const { isTauriApp, appVersion } = useTauriInfo();
  const { data: subscriptions = [] } = useGetNewsSubscriptions();
  const { data: hiddenAgents = [] } = useGetHiddenAgents();
  const { mutateAsync: createSubscription, isPending: isCreatingSubscription } =
    useCreateNewsSubscription();
  const { mutate: deleteSubscription } = useDeleteNewsSubscription();
  const { mutateAsync: deliverSubscription, isPending: isDelivering } =
    useDeliverNewsSubscription();
  const [subscriptionName, setSubscriptionName] = useState("重点新闻推送");
  const [keywordsText, setKeywordsText] = useState("英伟达, 苹果, 美联储");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [enabled, setEnabled] = useState(true);
  const [realtimeTracking, setRealtimeTracking] = useState(true);
  const [lastDelivery, setLastDelivery] = useState("");

  const handleCreateSubscription = async () => {
    const keywords = keywordsText
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      return;
    }

    const parsedInterval = Number.parseInt(intervalMinutes, 10);
    if (!Number.isFinite(parsedInterval) || parsedInterval < 5) {
      return;
    }

    await createSubscription({
      name: subscriptionName.trim() || "重点新闻推送",
      keywords,
      interval_minutes: parsedInterval,
      enabled,
      realtime_tracking: realtimeTracking,
    });
  };

  const handleDeliverNow = async (subscriptionId: string) => {
    const res = await deliverSubscription(subscriptionId);
    setLastDelivery(res.data.content || "");
  };
  // const { email, id } = useSystemInfo();
  // const isLoggedIn = useIsLoggedIn();

  // const { mutate: signOut } = useSignOut();
  return (
    <div className="flex flex-1 flex-col gap-4 p-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-bold text-xl">{t("general.title")}</h1>
        <p className="font-normal text-muted-foreground text-sm">
          {t("general.description")}
        </p>
      </div>

      <FieldGroup className="gap-6">
        {/* Account section - commented out for now
        {isTauriApp && (
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle className="font-medium text-base">
                {t("general.account.title")}
              </FieldTitle>
              <FieldDescription>
                {isLoggedIn ? email : t("general.account.signInDesc")}
              </FieldDescription>
            </FieldContent>
            {isLoggedIn ? (
              <Button
                variant="outline"
                onClick={() => signOut()}
                {...withTrack("logout", { user_id: id })}
              >
                {t("general.account.signOut")}
              </Button>
            ) : (
              <LoginModal>
                <Button>{t("general.account.signIn")}</Button>
              </LoginModal>
            )}
          </Field>
        )}
        */}

        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle className="font-medium text-base">
              {t("general.language.title")}
            </FieldTitle>
            <FieldDescription>
              {t("general.language.description")}
            </FieldDescription>
          </FieldContent>
          <Select
            value={language}
            onValueChange={(value) => setLanguage(value as LanguageCode)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">
                {t("general.language.options.en")}
              </SelectItem>
              <SelectItem value="zh_CN">
                {t("general.language.options.zh_CN")}
              </SelectItem>
              <SelectItem value="zh_TW">
                {t("general.language.options.zh_TW")}
              </SelectItem>
              <SelectItem value="ja">
                {t("general.language.options.ja")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle className="font-medium text-base">
              {t("general.theme.title")}
            </FieldTitle>
            <FieldDescription>
              {t("general.theme.description")}
            </FieldDescription>
          </FieldContent>
          <Select
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(value)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                {t("general.theme.options.system")}
              </SelectItem>
              <SelectItem value="light">
                {t("general.theme.options.light")}
              </SelectItem>
              <SelectItem value="dark">
                {t("general.theme.options.dark")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle className="font-medium text-base">
              {t("general.quotesColor.title")}
            </FieldTitle>
            <FieldDescription>
              {t("general.quotesColor.description")}
            </FieldDescription>
          </FieldContent>
          <RadioGroup
            className="flex gap-3"
            value={stockColorMode}
            onValueChange={(value) =>
              setStockColorMode(value as StockColorMode)
            }
          >
            <FieldLabel
              className="flex cursor-pointer items-center space-x-3 text-nowrap rounded-lg border border-border p-3"
              htmlFor="green-up"
            >
              <RadioGroupItem value="GREEN_UP_RED_DOWN" id="green-up" />
              {t("general.quotesColor.greenUpRedDown")}
            </FieldLabel>
            <FieldLabel
              className="flex cursor-pointer items-center space-x-3 text-nowrap rounded-lg border border-border p-3"
              htmlFor="red-up"
            >
              <RadioGroupItem value="RED_UP_GREEN_DOWN" id="red-up" />
              {t("general.quotesColor.redUpGreenDown")}
            </FieldLabel>
          </RadioGroup>
        </Field>

        <Field orientation="vertical" className="gap-3 rounded-lg border p-4">
          <FieldContent>
            <FieldTitle className="font-medium text-base">
              个性化定时新闻传递
            </FieldTitle>
            <FieldDescription>
              配置关键词、推送频率，并可一键触发实时跟踪关键信息。
            </FieldDescription>
          </FieldContent>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              value={subscriptionName}
              onChange={(event) => setSubscriptionName(event.target.value)}
              placeholder="订阅名称，例如：科技巨头追踪"
            />
            <Input
              value={keywordsText}
              onChange={(event) => setKeywordsText(event.target.value)}
              placeholder="关键词，使用逗号分隔"
            />
            <Input
              value={intervalMinutes}
              onChange={(event) => setIntervalMinutes(event.target.value)}
              placeholder="推送间隔（分钟，最小5）"
            />

            <div className="flex items-center gap-6 rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-sm">启用定时推送</span>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={realtimeTracking}
                  onCheckedChange={setRealtimeTracking}
                />
                <span className="text-sm">实时跟踪</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleCreateSubscription}
              disabled={isCreatingSubscription}
            >
              保存新闻订阅
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {subscriptions.length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无新闻订阅</p>
            ) : (
              subscriptions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {item.keywords.join(" / ")} · 每 {item.interval_minutes} 分钟
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeliverNow(item.id)}
                      disabled={isDelivering}
                    >
                      立即跟踪
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSubscription(item.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {lastDelivery && (
            <div className="rounded-md border p-3 text-sm">
              <p className="mb-1 font-medium">最近一次跟踪结果</p>
              <p className="line-clamp-6 whitespace-pre-wrap text-muted-foreground">
                {lastDelivery}
              </p>
            </div>
          )}
        </Field>

        <Field orientation="vertical" className="gap-2 rounded-lg border p-4">
          <FieldContent>
            <FieldTitle className="font-medium text-base">
              系统隐藏模块检查
            </FieldTitle>
            <FieldDescription>
              当前系统中被标记为隐藏的模块如下。
            </FieldDescription>
          </FieldContent>

          {hiddenAgents.length === 0 ? (
            <p className="text-muted-foreground text-sm">未发现隐藏模块</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hiddenAgents.map((agent) => (
                <Badge key={agent.agent_name} variant="secondary">
                  {agent.display_name} ({agent.agent_name})
                </Badge>
              ))}
            </div>
          )}
        </Field>

        {isTauriApp && (
          <Field orientation="responsive">
            <FieldTitle className="flex items-center gap-2 font-medium text-base">
              {t("general.updates.title")}
              {appVersion && <Badge variant="secondary">v{appVersion}</Badge>}
            </FieldTitle>
            <Button variant="outline" onClick={checkAndUpdate}>
              {t("general.updates.check")}
            </Button>
          </Field>
        )}
      </FieldGroup>
    </div>
  );
}
