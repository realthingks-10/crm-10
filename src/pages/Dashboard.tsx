import YearlyRevenueSummary from "@/components/YearlyRevenueSummary";
const Dashboard = () => {
  return <div className="flex flex-col h-full overflow-hidden">
      {/* Header - fixed height matching sidebar */}
      <div className="flex-shrink-0 h-16 border-b bg-background px-6 flex items-center">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl font-semibold text-foreground">Revenue Analytics









        </h1>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-auto p-6">
        {/* Yearly Revenue Summary Section */}
        <YearlyRevenueSummary />

        {/* Placeholder for additional dashboard content */}
        <div className="mt-8 space-y-6">
          {/* Add your quarterly breakdown or charts here */}
        </div>
      </div>
    </div>;
};
export default Dashboard;