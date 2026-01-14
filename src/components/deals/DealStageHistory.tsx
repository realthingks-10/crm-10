import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowRight, Clock, Loader2, GitBranch, History } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { getDealStageColor } from '@/utils/statusBadgeUtils';
import { RecordChangeHistory } from '@/components/shared/RecordChangeHistory';

interface StageChange {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
}

interface DealStageHistoryProps {
  dealId: string;
}

export const DealStageHistory = ({ dealId }: DealStageHistoryProps) => {
  const [history, setHistory] = useState<StageChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stages');
  
  const userIds = history.map(h => h.changed_by).filter(Boolean) as string[];
  const { displayNames } = useUserDisplayNames(userIds);

  useEffect(() => {
    fetchHistory();
  }, [dealId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('deal_stage_history')
        .select('*')
        .eq('deal_id', dealId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching stage history:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStageHistory = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (history.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No stage changes recorded yet</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[250px] pr-4">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-4">
            {history.map((change, index) => (
              <div key={change.id} className="relative pl-10">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <ArrowRight className="h-3 w-3" />
                </div>
                
                <div className="bg-card border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {change.from_stage ? (
                        <>
                          <Badge variant="outline" className={getDealStageColor(change.from_stage)}>
                            {change.from_stage}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Created as</span>
                      )}
                      <Badge variant="outline" className={getDealStageColor(change.to_stage)}>
                        {change.to_stage}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(change.changed_at), 'dd/MM/yyyy HH:mm')}
                    </div>
                  </div>
                  
                  {change.changed_by && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Changed by {displayNames[change.changed_by] || 'Unknown User'}
                    </p>
                  )}
                  
                  {change.notes && (
                    <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                      {change.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="stages" className="gap-2">
          <GitBranch className="h-4 w-4" />
          Stage Changes
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-2">
          <History className="h-4 w-4" />
          Field History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stages">
        {renderStageHistory()}
      </TabsContent>

      <TabsContent value="history">
        <RecordChangeHistory entityType="deals" entityId={dealId} maxHeight="250px" />
      </TabsContent>
    </Tabs>
  );
};
