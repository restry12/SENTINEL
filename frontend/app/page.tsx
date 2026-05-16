import { TopBar } from "@/components/dashboard/top-bar"
import { LeftPanel } from "@/components/dashboard/left-panel"
import { MapPanel } from "@/components/dashboard/map-panel"
import { RightPanel } from "@/components/dashboard/right-panel"
import { MetricCards } from "@/components/dashboard/metric-cards"
import { SafeRoute } from "@/components/dashboard/safe-route"
import { InfoSections } from "@/components/dashboard/info-sections"

export default function Dashboard() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar />
      
      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <LeftPanel />
        <MapPanel />
        <RightPanel />
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        <MapPanel />
        <MetricCards />
        <SafeRoute />
        <InfoSections />
      </div>
    </div>
  )
}
