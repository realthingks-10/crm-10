import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Search, AlertTriangle, Activity, FileText, Filter, Undo } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RevertConfirmDialog } from "@/components/feeds/RevertConfirmDialog";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

type ValidTableName = 'contacts' | 'deals' | 'leads';

const AuditLogsSettings = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [reverting, setReverting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    if (logs.length > 0) {
      fetchUserNames();
    }
  }, [logs]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, actionFilter]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      console.log('Fetching audit logs...');
      
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
      }

      console.log('Fetched audit logs:', data?.length || 0, 'records');

      const transformedLogs: AuditLog[] = (data || []).map(log => ({
        id: log.id,
        user_id: log.user_id || '',
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id || undefined,
        details: log.details || undefined,
        ip_address: log.ip_address ? String(log.ip_address) : undefined,
        created_at: log.created_at
      }));

      setLogs(transformedLogs);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs: " + (error.message || 'Unknown error'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserNames = async () => {
    try {
      const uniqueUserIds = Array.from(new Set(logs.map(log => log.user_id).filter(Boolean)));
      if (uniqueUserIds.length === 0) return;

      // Try to fetch display names from edge function first
      try {
        const { data, error } = await supabase.functions.invoke('fetch-user-display-names', {
          body: { userIds: uniqueUserIds }
        });

        if (!error && data?.userDisplayNames) {
          setUserNames(data.userDisplayNames);
          return;
        }
      } catch (edgeFunctionError) {
        console.log('Edge function not available, using fallback method');
      }

      // Fallback: create display names from user IDs
      const fallbackNames: Record<string, string> = {};
      uniqueUserIds.forEach((userId, index) => {
        fallbackNames[userId] = `User ${index + 1}`;
      });
      setUserNames(fallbackNames);
    } catch (error) {
      console.error('Error fetching user names:', error);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resource_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => {
        switch (actionFilter) {
          case 'user_management':
            return ['USER_CREATED', 'USER_DELETED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'ROLE_CHANGE', 'PASSWORD_RESET', 'ADMIN_ACTION', 'USER_ROLE_UPDATED', 'USER_STATUS_CHANGED', 'NEW_USER_REGISTERED'].includes(log.action) ||
              log.action.includes('USER_') || log.action.includes('ROLE_') ||
              log.resource_type === 'user_roles' || log.resource_type === 'profiles' || log.resource_type === 'user_management';
          case 'record_changes':
            return ['CREATE', 'UPDATE', 'DELETE', 'BULK_CREATE', 'BULK_UPDATE', 'BULK_DELETE'].includes(log.action) ||
              ['contacts', 'deals', 'leads'].includes(log.resource_type);
          case 'authentication':
            return log.action.includes('SESSION_') || log.action.includes('LOGIN') || log.action.includes('LOGOUT') || log.action.includes('AUTH') || log.resource_type === 'auth';
          case 'export':
            return log.action.includes('EXPORT') || log.action.includes('DATA_EXPORT') || log.action.includes('IMPORT') || log.action.includes('DATA_IMPORT') || log.resource_type.includes('export') || log.resource_type.includes('import');
          default:
            return true;
        }
      });
    }

    if (actionFilter === 'authentication' || actionFilter === 'all') {
      filtered = deduplicateAuthLogs(filtered);
    }

    setFilteredLogs(filtered);
  };

  const deduplicateAuthLogs = (allLogs: AuditLog[]) => {
    const authLogs = allLogs.filter(log => 
      log.action.includes('SESSION_') || log.action.includes('LOGIN') || log.action.includes('LOGOUT') || log.resource_type === 'auth'
    );
    const nonAuthLogs = allLogs.filter(log => 
      !(log.action.includes('SESSION_') || log.action.includes('LOGIN') || log.action.includes('LOGOUT') || log.resource_type === 'auth')
    );

    if (authLogs.length === 0) return allLogs;

    const meaningfulAuthLogs = authLogs.filter(log => 
      !log.action.includes('SESSION_ACTIVE') && !log.action.includes('SESSION_INACTIVE') && 
      !log.action.includes('SESSION_START') && !log.action.includes('SESSION_END')
    );

    const limitedAuthLogs: AuditLog[] = [];
    const userDailyMap = new Map<string, { date: string; logins: AuditLog[]; logouts: AuditLog[]; others: AuditLog[]; }>();

    meaningfulAuthLogs.forEach(log => {
      const userId = log.user_id || 'system';
      const logDate = format(new Date(log.created_at), 'yyyy-MM-dd');
      const dailyKey = `${userId}-${logDate}`;

      if (!userDailyMap.has(dailyKey)) {
        userDailyMap.set(dailyKey, { date: logDate, logins: [], logouts: [], others: [] });
      }

      const dailyData = userDailyMap.get(dailyKey)!;
      if (log.action.includes('LOGIN')) {
        dailyData.logins.push(log);
      } else if (log.action.includes('LOGOUT')) {
        dailyData.logouts.push(log);
      } else {
        dailyData.others.push(log);
      }
    });

    userDailyMap.forEach(dailyData => {
      dailyData.logins.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      dailyData.logouts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let eventCount = 0;

      if (dailyData.logins.length > 0 && eventCount < 2) {
        limitedAuthLogs.push(dailyData.logins[0]);
        eventCount++;
      }

      if (dailyData.logouts.length > 0 && eventCount < 2) {
        limitedAuthLogs.push(dailyData.logouts[dailyData.logouts.length - 1]);
        eventCount++;
      }

      limitedAuthLogs.push(...dailyData.others);
    });

    const combinedLogs = [...limitedAuthLogs, ...nonAuthLogs];
    return combinedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const exportAuditTrail = async () => {
    try {
      const csvContent = [
        ['Timestamp', 'User ID', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'Details'].join(','),
        ...filteredLogs.map(log => [
          format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
          log.user_id || '',
          log.action,
          log.resource_type,
          log.resource_id || '',
          log.ip_address || '',
          JSON.stringify(log.details || {}).replace(/,/g, ';')
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Audit trail exported successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export audit trail",
        variant: "destructive",
      });
    }
  };

  const canRevert = (log: AuditLog) => {
    // Only allow reverting CREATE, UPDATE, DELETE actions on data tables
    return ['CREATE', 'UPDATE', 'DELETE'].includes(log.action) && 
           ['contacts', 'deals', 'leads'].includes(log.resource_type) &&
           log.resource_id &&
           log.details;
  };

  const isValidTableName = (tableName: string): tableName is ValidTableName => {
    return ['contacts', 'deals', 'leads'].includes(tableName);
  };

  const handleRevertClick = (log: AuditLog) => {
    console.log('Revert clicked for log:', log);
    setSelectedLog(log);
    setRevertDialogOpen(true);
  };

  const revertAction = async () => {
    if (!selectedLog) return;

    setReverting(true);
    try {
      const { action, resource_type, resource_id, details } = selectedLog;
      
      console.log('Starting revert operation:', {
        action,
        resource_type,
        resource_id,
        details
      });

      // Validate that this is a supported table
      if (!isValidTableName(resource_type)) {
        throw new Error(`Reverting ${resource_type} records is not supported`);
      }

      if (!resource_id) {
        throw new Error('Resource ID is required for revert operation');
      }

      if (action === 'DELETE' && details?.deleted_data) {
        console.log('Reverting DELETE - restoring record:', details.deleted_data);
        
        // For DELETE operations, restore the deleted record
        const recordToRestore = { ...details.deleted_data };
        
        // Ensure the ID is preserved
        if (!recordToRestore.id) {
          recordToRestore.id = resource_id;
        }

        const { error } = await supabase
          .from(resource_type)
          .insert([recordToRestore]);

        if (error) throw error;

        toast({
          title: "Success",
          description: `Deleted ${resource_type} record has been restored`,
        });

      } else if (action === 'UPDATE' && details?.old_data) {
        console.log('Reverting UPDATE - restoring old data:', details.old_data);
        
        // For UPDATE operations, restore to old data
        const { error } = await supabase
          .from(resource_type)
          .update(details.old_data)
          .eq('id', resource_id);

        if (error) throw error;

        toast({
          title: "Success",
          description: `${resource_type} record has been reverted to previous state`,
        });

      } else if (action === 'UPDATE' && details?.field_changes) {
        console.log('Reverting UPDATE using field_changes:', details.field_changes);
        
        // Extract old values from field_changes
        const oldData: Record<string, any> = {};
        Object.entries(details.field_changes).forEach(([field, change]: [string, any]) => {
          if (change && typeof change === 'object' && 'old' in change) {
            oldData[field] = change.old;
          }
        });

        if (Object.keys(oldData).length === 0) {
          throw new Error('No revertible data found in audit log');
        }

        console.log('Reverting with extracted old data:', oldData);

        const { error } = await supabase
          .from(resource_type)
          .update(oldData)
          .eq('id', resource_id);

        if (error) throw error;

        toast({
          title: "Success",
          description: `${resource_type} record has been reverted to previous state`,
        });

      } else if (action === 'CREATE') {
        console.log('Reverting CREATE - deleting created record');
        
        // For CREATE operations, delete the created record
        const { error } = await supabase
          .from(resource_type)
          .delete()
          .eq('id', resource_id);

        if (error) throw error;

        toast({
          title: "Success",
          description: `Created ${resource_type} record has been removed`,
        });
      } else {
        throw new Error(`Cannot revert ${action} operation - insufficient data in audit log`);
      }

      // Refresh logs after successful revert
      await fetchAuditLogs();
      
    } catch (error: any) {
      console.error('Error reverting action:', error);
      toast({
        title: "Error",
        description: `Failed to revert action: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setReverting(false);
      setRevertDialogOpen(false);
      setSelectedLog(null);
    }
  };

  const getActionIcon = (action: string) => {
    if (action === 'CREATE' || action === 'BULK_CREATE') return <Activity className="h-4 w-4 text-green-600" />;
    if (action === 'UPDATE' || action === 'BULK_UPDATE') return <FileText className="h-4 w-4 text-blue-600" />;
    if (action === 'DELETE' || action === 'BULK_DELETE') return <AlertTriangle className="h-4 w-4 text-red-600" />;
    if (action.includes('USER')) return <Activity className="h-4 w-4" />;
    if (action.includes('DATA') || action.includes('EXPORT')) return <Download className="h-4 w-4" />;
    if (action.includes('SESSION')) return <Activity className="h-4 w-4 text-gray-500" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getActionBadgeVariant = (action: string) => {
    if (action === 'CREATE' || action === 'BULK_CREATE') return 'default';
    if (action === 'UPDATE' || action === 'BULK_UPDATE') return 'secondary';
    if (action === 'DELETE' || action === 'BULK_DELETE') return 'destructive';
    if (action.includes('CREATED') || action.includes('ACTIVATED')) return 'default';
    if (action.includes('DELETED') || action.includes('DEACTIVATED')) return 'destructive';
    if (action.includes('ROLE_CHANGE') || action.includes('PASSWORD_RESET')) return 'secondary';
    if (action.includes('SESSION')) return 'outline';
    return 'outline';
  };

  const getReadableAction = (action: string) => {
    switch (action) {
      case 'CREATE': return 'Created Record';
      case 'UPDATE': return 'Updated Record';
      case 'DELETE': return 'Deleted Record';
      case 'BULK_CREATE': return 'Bulk Created Records';
      case 'BULK_UPDATE': return 'Bulk Updated Records';
      case 'BULK_DELETE': return 'Bulk Deleted Records';
      case 'SESSION_START': return 'User Login';
      case 'SESSION_END': return 'User Logout';
      case 'SESSION_ACTIVE': return 'Session Active';
      case 'SESSION_INACTIVE': return 'Session Inactive';
      default: return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getReadableResourceType = (resourceType: string) => {
    switch (resourceType) {
      case 'contacts': return 'Contacts';
      case 'leads': return 'Leads';
      case 'deals': return 'Deals';
      case 'auth': return 'Authentication';
      case 'user_roles': return 'User Roles';
      case 'profiles': return 'User Profiles';
      default: return resourceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Security Audit Logs
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchAuditLogs} variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={exportAuditTrail} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Trail
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search logs by action, resource, or details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="record_changes">Record Changes</SelectItem>
                <SelectItem value="authentication">Authentication (Clean)</SelectItem>
                <SelectItem value="user_management">User Management</SelectItem>
                <SelectItem value="export">Data Import/Export</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module/Resource</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Revert Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const isAuthLog = log.action.includes('SESSION_') || log.action.includes('LOGIN') || log.action.includes('LOGOUT');
                    const userName = log.user_id ? (userNames[log.user_id] || `User ${log.user_id.substring(0, 8)}...`) : 'System';
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)} className="flex items-center gap-1 w-fit">
                            {getActionIcon(log.action)}
                            {getReadableAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {log.details?.module || getReadableResourceType(log.resource_type)}
                          </span>
                          {log.resource_id && !isAuthLog}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{userName}</span>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {!isAuthLog && log.details?.field_changes && Object.keys(log.details.field_changes).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(log.details.field_changes).slice(0, 3).map(([field, change]: [string, any]) => (
                                <div key={field} className="text-sm">
                                  <span className="font-medium">{field}:</span>
                                  <span className="text-muted-foreground"> {String(change.old || 'null')} → </span>
                                  <span className="text-primary">{String(change.new || 'null')}</span>
                                </div>
                              ))}
                              {Object.keys(log.details.field_changes).length > 3 && (
                                <span className="text-sm text-muted-foreground">
                                  +{Object.keys(log.details.field_changes).length - 3} more...
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {log.details && (
                            <details className="cursor-pointer">
                              <summary className="text-sm text-muted-foreground hover:text-foreground">
                                View details
                              </summary>
                              <pre className="text-sm mt-2 p-2 bg-muted rounded whitespace-pre-wrap">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </TableCell>
                        <TableCell>
                          {canRevert(log) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRevertClick(log)}
                              disabled={reverting}
                              className="flex items-center gap-1"
                            >
                              <Undo className="h-3 w-3" />
                              Revert
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {filteredLogs.length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm || actionFilter !== 'all' ? 'No logs match your filters' : 'No audit logs found'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start using the application to generate audit logs
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Log Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{logs.length}</div>
              <div className="text-sm text-muted-foreground">Total Events</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {logs.filter(log => log.action.includes('USER')).length}
              </div>
              <div className="text-sm text-muted-foreground">User Management</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {logs.filter(log => ['CREATE', 'UPDATE', 'DELETE', 'BULK_CREATE', 'BULK_UPDATE', 'BULK_DELETE'].includes(log.action)).length}
              </div>
              <div className="text-sm text-muted-foreground">Record Changes</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {logs.filter(log => log.action.includes('EXPORT')).length}
              </div>
              <div className="text-sm text-muted-foreground">Data Exports</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <RevertConfirmDialog
        open={revertDialogOpen}
        onConfirm={revertAction}
        onCancel={() => {
          setRevertDialogOpen(false);
          setSelectedLog(null);
        }}
      />
    </div>
  );
};

export default AuditLogsSettings;
