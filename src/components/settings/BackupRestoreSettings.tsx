import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { 
  Database, Download, Upload, Trash2, RefreshCw, ShieldAlert,
  Clock, HardDrive, FileJson, CalendarClock, FileText, Users,
  Building2, Briefcase, CheckSquare
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Backup {
  id: string;
  file_name: string;
  file_path: string;
  size_bytes: number;
  tables_count: number;
  records_count: number;
  backup_type: string;
  module_name: string | null;
  status: string;
  manifest: any;
  created_at: string;
  created_by: string;
}

interface BackupSchedule {
  id?: string;
  frequency: string;
  time_of_day: string;
  is_enabled: boolean;
  next_run_at?: string;
  last_run_at?: string;
}

const MODULES = [
  { id: 'leads', name: 'Leads', icon: FileText, color: 'border-l-blue-500' },
  { id: 'contacts', name: 'Contacts', icon: Users, color: 'border-l-green-500' },
  { id: 'accounts', name: 'Accounts', icon: Building2, color: 'border-l-purple-500' },
  { id: 'deals', name: 'Deals', icon: Briefcase, color: 'border-l-orange-500' },
  { id: 'action_items', name: 'Tasks', icon: CheckSquare, color: 'border-l-cyan-500' },
];

const BackupRestoreSettings = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingModule, setCreatingModule] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [schedule, setSchedule] = useState<BackupSchedule>({
    frequency: 'every_2_days',
    time_of_day: '00:00',
    is_enabled: false,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();

  const fetchBackups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('backups' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setBackups((data as any[]) || []);
    } catch (error: any) {
      console.error('Error fetching backups:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('backup_schedules' as any)
        .select('*')
        .limit(1)
        .single();

      if (data && !error) {
        setSchedule({
          id: (data as any).id,
          frequency: (data as any).frequency || 'every_2_days',
          time_of_day: (data as any).time_of_day || '00:00',
          is_enabled: (data as any).is_enabled || false,
          next_run_at: (data as any).next_run_at,
          last_run_at: (data as any).last_run_at,
        });
      }
    } catch {
      console.log('No backup schedule found, using defaults');
    }
  }, []);

  const fetchModuleCounts = useCallback(async () => {
    const tables = ['leads', 'contacts', 'accounts', 'deals', 'action_items'];
    const results: Record<string, number> = {};
    await Promise.all(tables.map(async (table) => {
      const { count } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
      results[table] = count || 0;
    }));
    setModuleCounts(results);
  }, []);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchBackups();
      fetchSchedule();
      fetchModuleCounts();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [fetchBackups, fetchSchedule, fetchModuleCounts, isAdmin, roleLoading]);

  const handleSaveSchedule = async (newSchedule: BackupSchedule) => {
    setSavingSchedule(true);
    try {
      const scheduleData = {
        frequency: newSchedule.frequency,
        time_of_day: newSchedule.time_of_day,
        is_enabled: newSchedule.is_enabled,
        created_by: user?.id,
      };

      if (schedule.id) {
        const { error } = await supabase
          .from('backup_schedules' as any)
          .update(scheduleData)
          .eq('id', schedule.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('backup_schedules' as any)
          .insert(scheduleData)
          .select()
          .single();
        if (error) throw error;
        if (data) setSchedule(prev => ({ ...prev, id: (data as any).id }));
      }
      toast.success(newSchedule.is_enabled ? 'Scheduled backup enabled' : 'Scheduled backup disabled');
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save backup schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCreateBackup = async (moduleName?: string) => {
    if (moduleName) {
      setCreatingModule(moduleName);
    } else {
      setCreating(true);
    }
    try {
      const body: any = { backupType: 'manual' };
      if (moduleName) body.moduleName = moduleName;

      const { error } = await supabase.functions.invoke('create-backup', {
        method: 'POST',
        body,
      });
      if (error) throw error;
      toast.success(moduleName ? `${moduleName} backup created` : 'Full backup created successfully');
      await fetchBackups();
      if (moduleName) await fetchModuleCounts();
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast.error(error.message || 'Failed to create backup');
    } finally {
      setCreating(false);
      setCreatingModule(null);
    }
  };

  const handleDownloadBackup = async (backup: Backup) => {
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .download(backup.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error: any) {
      console.error('Error downloading backup:', error);
      toast.error('Failed to download backup');
    }
  };

  const handleRestoreClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setConfirmText('');
    setShowRestoreDialog(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedBackup || confirmText !== 'CONFIRM') return;
    setRestoring(selectedBackup.id);
    setShowRestoreDialog(false);
    try {
      const { error } = await supabase.functions.invoke('restore-backup', {
        method: 'POST',
        body: { backupId: selectedBackup.id },
      });
      if (error) throw error;
      toast.success('Restore completed successfully');
      await fetchModuleCounts();
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      toast.error(error.message || 'Failed to restore backup');
    } finally {
      setRestoring(null);
      setSelectedBackup(null);
    }
  };

  const handleDeleteClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedBackup) return;
    setDeleting(selectedBackup.id);
    setShowDeleteDialog(false);
    try {
      await supabase.storage.from('backups').remove([selectedBackup.file_path]);
      await supabase.from('backups' as any).delete().eq('id', selectedBackup.id);
      toast.success('Backup deleted');
      await fetchBackups();
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      toast.error('Failed to delete backup');
    } finally {
      setDeleting(null);
      setSelectedBackup(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Access Denied</h3>
        <p className="text-sm text-muted-foreground">Only administrators can manage backups.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Export / Import */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>Create a complete backup of all CRM data</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => handleCreateBackup()} disabled={creating}>
                {creating ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating Backup...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" />Export All Data</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5" />
                Import Data
              </CardTitle>
              <CardDescription>Restore from a previous backup</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Import Backup File
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Use the restore option from backup history below
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Backup */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-muted-foreground" />
                  <Label htmlFor="scheduled-backup" className="text-base">Scheduled Backups</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically create backups every 2 days
                </p>
              </div>
              <Switch
                id="scheduled-backup"
                checked={schedule.is_enabled}
                onCheckedChange={(checked) => {
                  const newSchedule = { ...schedule, is_enabled: checked };
                  setSchedule(newSchedule);
                  handleSaveSchedule(newSchedule);
                }}
              />
            </div>
            {schedule.is_enabled && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Time:</Label>
                    <Select
                      value={schedule.time_of_day}
                      onValueChange={(value) => {
                        const newSchedule = { ...schedule, time_of_day: value };
                        setSchedule(newSchedule);
                        handleSaveSchedule(newSchedule);
                      }}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="00:00">12:00 AM</SelectItem>
                        <SelectItem value="06:00">6:00 AM</SelectItem>
                        <SelectItem value="12:00">12:00 PM</SelectItem>
                        <SelectItem value="18:00">6:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {savingSchedule && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Next Run
                    </p>
                    <p className="text-sm font-medium">
                      {schedule.next_run_at
                        ? format(new Date(schedule.next_run_at), 'MMM d, yyyy HH:mm')
                        : 'Pending...'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Last Run
                    </p>
                    <p className="text-sm font-medium">
                      {schedule.last_run_at
                        ? format(new Date(schedule.last_run_at), 'MMM d, yyyy HH:mm')
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module-wise Backup */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5" />
                  Module Backup
                </CardTitle>
                <CardDescription>Backup individual modules separately</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchModuleCounts}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MODULES.map((module) => {
                const Icon = module.icon;
                return (
                  <Card key={module.id} className={`border-l-4 ${module.color}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{module.name}</h4>
                            <Badge variant="secondary" className="mt-1">
                              {moduleCounts[module.id]?.toLocaleString() || 0} records
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleCreateBackup(module.id)}
                        disabled={creatingModule === module.id}
                      >
                        {creatingModule === module.id ? (
                          <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Backing up...</>
                        ) : (
                          <><Download className="h-3 w-3 mr-1" />Backup {module.name}</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Backup History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Backup History
            </CardTitle>
            <CardDescription>
              Recent backups with download and restore options (max 30)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No backups found</p>
                <p className="text-sm">Create your first backup to get started</p>
              </div>
            ) : (
              backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{backup.file_name}</span>
                      {backup.backup_type === 'module' && backup.module_name && (
                        <Badge variant="outline" className="text-xs">{backup.module_name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(backup.created_at), 'dd/MM/yyyy, HH:mm')}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {backup.backup_type === 'scheduled' ? 'Scheduled' : backup.backup_type === 'module' ? 'Module' : 'Manual'}
                      </Badge>
                      <span>{backup.tables_count} tables • {backup.records_count?.toLocaleString()} records</span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(backup.size_bytes)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadBackup(backup)}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRestoreClick(backup)}
                      disabled={restoring === backup.id}
                    >
                      {restoring === backup.id ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Database className="h-4 w-4 mr-1" />
                      )}
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(backup)}
                      disabled={deleting === backup.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting === backup.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Confirm Restore</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>You are about to restore from backup:</p>
                <p className="font-mono text-sm bg-muted p-2 rounded">{selectedBackup?.file_name}</p>
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-sm">
                  <p className="font-semibold text-destructive">This action will:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Overwrite current database data</li>
                    <li>Replace existing records in backed-up tables</li>
                    <li>Cannot be undone</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label>Type "CONFIRM" to proceed:</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CONFIRM"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={confirmText !== 'CONFIRM'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restore Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Are you sure you want to delete this backup? This action cannot be undone.</p>
                <p className="font-mono text-sm bg-muted p-2 rounded mt-2">{selectedBackup?.file_name}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BackupRestoreSettings;
