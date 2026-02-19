import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useGetAgentList } from "@/api/agent";
import { AgentMarketSkeleton } from "@/components/valuecell/skeleton";
import { AgentCard } from "./components/agent-card";

export default function AgentMarket() {
  const { t } = useTranslation();
  const { data: agents = [], isLoading } = useGetAgentList();

  if (isLoading) {
    return <AgentMarketSkeleton />;
  }

  return (
    <div className="flex size-full flex-col items-center justify-start gap-8 bg-card pt-8">
      {/* Page Title */}
      <h1 className="w-full text-center font-medium text-3xl leading-7">
        {t("market.title")}
      </h1>

      {/* Agent Cards Grid */}
      <div className="scroll-container grid w-full grid-cols-[repeat(auto-fit,minmax(320px,320px))] justify-center gap-4 pb-8">
        {agents.map((agent) => (
          <div key={agent.agent_name} className="break-inside-avoid">
            <Link to={`/agent/${agent.agent_name}/config`}>
              <AgentCard agent={agent} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
