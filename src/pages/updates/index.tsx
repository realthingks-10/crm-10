import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Wrench, HardDrive } from "lucide-react";
import SystemUpdatesTab from "./components/SystemUpdatesTab";
import MaintenanceTab from "./components/MaintenanceTab";
import BackupsTab from "./components/BackupsTab";

const UpdatesPage = () => {
  const [activeTab, setActiveTab] = useState("updates");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Windows & System Updates</h1>
          <p className="text-muted-foreground">Manage system updates, maintenance schedules, and backups</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="updates" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            System Updates
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="backups" className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Backups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="updates" className="mt-6">
          <SystemUpdatesTab />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <MaintenanceTab />
        </TabsContent>

        <TabsContent value="backups" className="mt-6">
          <BackupsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UpdatesPage;
