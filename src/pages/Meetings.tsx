import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useMeetingsImportExport } from "@/hooks/useMeetingsImportExport";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Video, Trash2, Edit, Calendar, ArrowUpDown, ArrowUp, ArrowDown, List, CalendarDays, CheckCircle2, AlertCircle, UserX, CalendarClock, User, Columns, Upload, Download, X, Eye, CheckSquare } from "lucide-react";
import { RowActionsDropdown } from "@/components/RowActionsDropdown";
import { HighlightedText } from "@/components/shared/HighlightedText";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MeetingsCalendarView } from "@/components/meetings/MeetingsCalendarView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeetingModal } from "@/components/MeetingModal";
import { MeetingColumnCustomizer, defaultMeetingColumns, MeetingColumnConfig } from "@/components/meetings/MeetingColumnCustomizer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TablePagination } from "@/components/shared/TablePagination";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getMeetingStatus } from "@/utils/meetingStatus";
import { getMeetingStatusColor } from "@/utils/statusBadgeUtils";
import { MeetingDetailModal } from "@/components/meetings/MeetingDetailModal";

type SortColumn = 'subject' | 'date' | 'time' | 'lead_contact' | 'status' | null;
type SortDirection = 'asc' | 'desc';

interface Meeting {
  id: string;
  subject: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  join_url?: string | null;
  attendees?: unknown;
  lead_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  deal_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  status: string;
  outcome?: string | null;
  notes?: string | null;
  lead_name?: string | null;
  contact_name?: string | null;
}

const ITEMS_PER_PAGE = 25;

const Meetings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialStatus = searchParams.get('status') || 'all';
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  // Removed filteredMeetings state - using sortedAndFilteredMeetings directly
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [organizerFilter, setOrganizerFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>('subject');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Column customizer state with persistence
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const { columns, saveColumns, isSaving } = useColumnPreferences({
    moduleName: 'meetings',
    defaultColumns: defaultMeetingColumns,
  });
  const [localColumns, setLocalColumns] = useState<MeetingColumnConfig[]>([]);
  const [isColumnsInitialized, setIsColumnsInitialized] = useState(false);

  // Only initialize columns once when they first load from preferences
  useEffect(() => {
    if (columns.length > 0 && !isColumnsInitialized) {
      setLocalColumns(columns);
      setIsColumnsInitialized(true);
    }
  }, [columns, isColumnsInitialized]);

  const handleCreateTask = (meeting: Meeting) => {
    const params = new URLSearchParams({
      create: '1',
      module: 'meetings',
      recordId: meeting.id,
      recordName: encodeURIComponent(meeting.subject || 'Meeting'),
      return: '/meetings',
      returnViewId: meeting.id,
    });
    navigate(`/tasks?${params.toString()}`);
  };

  // Get owner parameter from URL - "me" means filter by current user
  const ownerParam = searchParams.get('owner');

  // Import/Export hook
  const { handleImport, handleExport, isImporting, isExporting, fileInputRef, triggerFileInput } = useMeetingsImportExport(() => {
    fetchMeetings();
  });

  // Sync owner filter when URL has owner=me
  useEffect(() => {
    if (ownerParam === 'me' && user?.id) {
      setOrganizerFilter(user.id);
    } else if (!ownerParam) {
      setOrganizerFilter('all');
    }
  }, [ownerParam, user?.id]);

  // Sync statusFilter when URL changes
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  // viewId effect is moved below the meetings query

  // Fetch all profiles for organizer dropdown with caching
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch meetings with React Query caching
  const { data: meetings = [], isLoading: loading, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meetings').select(`
          *,
          leads:lead_id (lead_name),
          contacts:contact_id (contact_name)
        `).order('start_time', {
        ascending: true
      });
      if (error) throw error;
      return (data || []).map(meeting => ({
        ...meeting,
        lead_name: meeting.leads?.lead_name,
        contact_name: meeting.contacts?.contact_name
      })) as Meeting[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const fetchMeetings = () => {
    refetchMeetings();
  };

  // Get organizer display names
  const organizerIds = useMemo(() => {
    return [...new Set(meetings.map(m => m.created_by).filter(Boolean))] as string[];
  }, [meetings]);
  const { displayNames: organizerNames } = useUserDisplayNames(organizerIds);

  // Handle viewId from URL (from global search)
  useEffect(() => {
    const viewId = searchParams.get('viewId');
    if (viewId && meetings.length > 0) {
      const meetingToView = meetings.find(m => m.id === viewId);
      if (meetingToView) {
        setEditingMeeting(meetingToView);
        setShowModal(true);
        setSearchParams(prev => {
          prev.delete('viewId');
          return prev;
        }, { replace: true });
      }
    }
  }, [searchParams, meetings, setSearchParams]);

  const getEffectiveStatus = (meeting: Meeting) => {
    return getMeetingStatus(meeting);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    return null; // Hide sort icons but keep sorting on click
  };

  const sortedAndFilteredMeetings = useMemo(() => {
    let filtered = meetings.filter(meeting => {
      const matchesSearch = meeting.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || meeting.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) || meeting.contact_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || getEffectiveStatus(meeting) === statusFilter;
      const matchesOrganizer = organizerFilter === "all" || meeting.created_by === organizerFilter;
      
      return matchesSearch && matchesStatus && matchesOrganizer;
    });
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';
        switch (sortColumn) {
          case 'subject':
            aValue = a.subject?.toLowerCase() || '';
            bValue = b.subject?.toLowerCase() || '';
            break;
          case 'date':
            aValue = new Date(a.start_time).setHours(0, 0, 0, 0);
            bValue = new Date(b.start_time).setHours(0, 0, 0, 0);
            break;
          case 'time':
            const aDate = new Date(a.start_time);
            const bDate = new Date(b.start_time);
            aValue = aDate.getHours() * 60 + aDate.getMinutes();
            bValue = bDate.getHours() * 60 + bDate.getMinutes();
            break;
          case 'lead_contact':
            aValue = (a.lead_name || a.contact_name || '').toLowerCase();
            bValue = (b.lead_name || b.contact_name || '').toLowerCase();
            break;
          case 'status':
            aValue = getEffectiveStatus(a);
            bValue = getEffectiveStatus(b);
            break;
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [meetings, searchTerm, statusFilter, organizerFilter, sortColumn, sortDirection]);

  // Reset to first page when filters change (without storing filtered in state)
  const prevFilterKey = useRef('');
  const filterKey = `${searchTerm}-${statusFilter}-${organizerFilter}`;
  if (filterKey !== prevFilterKey.current) {
    prevFilterKey.current = filterKey;
    if (currentPage !== 1) setCurrentPage(1);
  }

  // Use sortedAndFilteredMeetings directly instead of storing in state
  const totalPages = Math.ceil(sortedAndFilteredMeetings.length / ITEMS_PER_PAGE);
  const paginatedMeetings = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAndFilteredMeetings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAndFilteredMeetings, currentPage]);

  const handleDelete = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Meeting deleted successfully"
      });
      fetchMeetings();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const {
        error
      } = await supabase.from('meetings').delete().in('id', selectedMeetings);
      if (error) throw error;
      toast({
        title: "Success",
        description: `${selectedMeetings.length} meeting(s) deleted successfully`
      });
      setSelectedMeetings([]);
      fetchMeetings();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete meetings",
        variant: "destructive"
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMeetings(paginatedMeetings.map(m => m.id));
    } else {
      setSelectedMeetings([]);
    }
  };

  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    if (checked) {
      setSelectedMeetings(prev => [...prev, meetingId]);
    } else {
      setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    }
  };

  const isAllSelected = paginatedMeetings.length > 0 && paginatedMeetings.every(m => selectedMeetings.includes(m.id));
  const isSomeSelected = paginatedMeetings.some(m => selectedMeetings.includes(m.id)) && !isAllSelected;

// Generate initials from subject
  const getMeetingInitials = (subject: string) => {
    return subject.split(' ').slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
  };

// Generate consistent vibrant color from subject
  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 
      'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600'];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Use shared status badge styling from utilities
  const getStatusBadgeClasses = (status: string) => getMeetingStatusColor(status);

  const getStatusBadge = (meeting: Meeting) => {
    const status = getEffectiveStatus(meeting);
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <Badge variant="outline" className={`whitespace-nowrap ${getStatusBadgeClasses(status)}`}>
        {label}
      </Badge>
    );
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return <span className="text-muted-foreground">—</span>;
    const outcomeConfig: Record<string, {
      label: string;
      icon: React.ReactNode;
      className: string;
    }> = {
      successful: {
        label: "Successful",
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
      },
      follow_up_needed: {
        label: "Follow-up",
        icon: <AlertCircle className="h-3 w-3" />,
        className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800"
      },
      no_show: {
        label: "No-show",
        icon: <UserX className="h-3 w-3" />,
        className: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800"
      },
      rescheduled: {
        label: "Rescheduled",
        icon: <CalendarClock className="h-3 w-3" />,
        className: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800"
      }
    };
    const config = outcomeConfig[outcome];
    if (!config) return <span className="text-muted-foreground">—</span>;
    return <Badge variant="outline" className={`gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>;
  };

  const isColumnVisible = (field: string) => {
    const col = localColumns.find(c => c.field === field);
    return col ? col.visible : true;
  };

  const handleClearOwnerFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('owner');
    setSearchParams(newParams);
    setOrganizerFilter('all');
  };

  const hasActiveFilters = statusFilter !== 'all' || organizerFilter !== 'all' || searchTerm !== '';

  const handleClearAllFilters = () => {
    setStatusFilter('all');
    setOrganizerFilter('all');
    setSearchTerm('');
    const newParams = new URLSearchParams();
    setSearchParams(newParams);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
      e.target.value = ''; // Reset input
    }
  };

  // Show skeleton instead of blocking full-screen loader
  const showSkeleton = loading && meetings.length === 0;

  return <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <h1 className="text-xl text-foreground font-semibold">Meetings</h1>
              {ownerParam === 'me' && (
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  My Meetings
                  <button
                    onClick={handleClearOwnerFilter}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
                <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Calendar
                </Button>
              </div>

              {/* Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowColumnCustomizer(true)}>
                    <Columns className="h-4 w-4 mr-2" />
                    Columns
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={triggerFileInput} disabled={isImporting}>
                    <Upload className="h-4 w-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport(sortedAndFilteredMeetings)} disabled={isExporting || sortedAndFilteredMeetings.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'Export CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    disabled={selectedMeetings.length === 0} 
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedMeetings.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button size="sm" onClick={() => {
              setEditingMeeting(null);
              setShowModal(true);
            }}>
                Add Meeting
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 pt-2 pb-4 flex flex-col">
        {showSkeleton ? (
          <div className="space-y-4 flex-1">
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-64 bg-muted animate-pulse rounded" />
          </div>
        ) : viewMode === 'calendar' ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <MeetingsCalendarView
              meetings={sortedAndFilteredMeetings}
              onMeetingClick={(meeting) => {
                setEditingMeeting(meeting);
                setShowModal(true);
              }}
              onMeetingUpdated={fetchMeetings}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Search and Bulk Actions */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search meetings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" inputSize="control" />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={organizerFilter} onValueChange={setOrganizerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Organizers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizers</SelectItem>
                  {allProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearAllFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}

              {/* Bulk Actions */}
              {selectedMeetings.length > 0 && <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    {selectedMeetings.length} selected
                  </span>
                  <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Selected
                  </Button>
                </div>}
            </div>

            {/* Table */}
            <Card className="flex-1 min-h-0 flex flex-col">
              <div className="relative overflow-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-20 bg-muted border-b-2 shadow-sm">
                    <TableHead className="w-[50px] text-center font-bold text-foreground bg-muted">
                      <Checkbox checked={isAllSelected} ref={el => {
                    if (el) {
                      (el as any).indeterminate = isSomeSelected;
                    }
                  }} onCheckedChange={handleSelectAll} aria-label="Select all" />
                    </TableHead>
                    {isColumnVisible('subject') && (
                      <TableHead className="min-w-[200px] font-bold text-foreground px-4 py-3 bg-muted">
                        <button onClick={() => handleSort('subject')} className="group flex items-center gap-2 cursor-pointer hover:text-primary">
                          Subject {getSortIcon('subject')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('date') && (
                      <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">
                        <button onClick={() => handleSort('date')} className="group flex items-center gap-2 cursor-pointer hover:text-primary">
                          Date {getSortIcon('date')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('time') && (
                      <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">
                        <button onClick={() => handleSort('time')} className="group flex items-center gap-2 cursor-pointer hover:text-primary">
                          Time {getSortIcon('time')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('lead_contact') && (
                      <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">
                        <button onClick={() => handleSort('lead_contact')} className="group flex items-center gap-2 cursor-pointer hover:text-primary">
                          Lead/Contact {getSortIcon('lead_contact')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('status') && (
                      <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">
                        <button onClick={() => handleSort('status')} className="group flex items-center gap-2 cursor-pointer hover:text-primary">
                          Status {getSortIcon('status')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('outcome') && <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Outcome</TableHead>}
                    {isColumnVisible('join_url') && <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Join URL</TableHead>}
                    {isColumnVisible('organizer') && <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Organizer</TableHead>}
                    <TableHead className="w-32 text-center font-bold text-foreground px-4 py-3 bg-muted">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMeetings.length === 0 ? <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        No meetings found
                      </TableCell>
                    </TableRow> : paginatedMeetings.map(meeting => <TableRow key={meeting.id} className={`hover:bg-muted/20 border-b group ${selectedMeetings.includes(meeting.id) ? "bg-muted/50" : ""}`}>
                        <TableCell className="text-center px-4 py-3">
                          <div className="flex justify-center">
                            <Checkbox checked={selectedMeetings.includes(meeting.id)} onCheckedChange={checked => handleSelectMeeting(meeting.id, !!checked)} aria-label={`Select ${meeting.subject}`} />
                          </div>
                        </TableCell>
                        {isColumnVisible('subject') && (
                          <TableCell className="px-4 py-3">
                            <button 
                              onClick={() => setViewingMeeting(meeting)}
                              className="text-primary hover:underline font-medium text-left truncate"
                            >
                              <HighlightedText text={meeting.subject} highlight={searchTerm} />
                            </button>
                          </TableCell>
                        )}
                        {isColumnVisible('date') && (
                          <TableCell className="text-sm px-4 py-3">
                            {format(new Date(meeting.start_time), 'dd/MM/yyyy')}
                          </TableCell>
                        )}
                        {isColumnVisible('time') && (
                          <TableCell className="text-sm text-muted-foreground px-4 py-3">
                            {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                          </TableCell>
                        )}
                        {isColumnVisible('lead_contact') && (
                          <TableCell className="px-4 py-3">
                            {meeting.lead_name && <div>Lead: {meeting.lead_name}</div>}
                            {meeting.contact_name && <div>Contact: {meeting.contact_name}</div>}
                            {!meeting.lead_name && !meeting.contact_name && <span className="text-center text-muted-foreground w-full block">-</span>}
                          </TableCell>
                        )}
                        {isColumnVisible('status') && <TableCell className="px-4 py-3">{getStatusBadge(meeting)}</TableCell>}
                        {isColumnVisible('outcome') && <TableCell className="px-4 py-3">{getOutcomeBadge(meeting.outcome || null)}</TableCell>}
                        {isColumnVisible('join_url') && (
                          <TableCell className="px-4 py-3">
                            {meeting.join_url ? (
                              <a 
                                href={meeting.join_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <Video className="h-4 w-4" />
                                {meeting.join_url.includes('teams') ? 'Join (Teams)' :
                                 meeting.join_url.includes('zoom') ? 'Join (Zoom)' :
                                 meeting.join_url.includes('meet.google') ? 'Join (Meet)' :
                                 meeting.join_url.includes('webex') ? 'Join (Webex)' :
                                 'Join Meeting'}
                              </a>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )}
                          </TableCell>
                        )}
                        {isColumnVisible('organizer') && (
                          <TableCell className="px-4 py-3">
                            {meeting.created_by ? (
                              <div className="flex items-center gap-1 text-sm">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate max-w-[120px]">
                                  {organizerNames[meeting.created_by] || 'Loading...'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="w-20 px-4 py-3">
                          <div className="flex items-center justify-center">
                            <RowActionsDropdown
                              actions={[
                                {
                                  label: "View",
                                  icon: <Eye className="w-4 h-4" />,
                                  onClick: () => {
                                    setViewingMeeting(meeting);
                                  }
                                },
                                {
                                  label: "Edit",
                                  icon: <Edit className="w-4 h-4" />,
                                  onClick: () => {
                                    setEditingMeeting(meeting);
                                    setShowModal(true);
                                  }
                                },
                                {
                                  label: "Create Task",
                                  icon: <CheckSquare className="w-4 h-4" />,
                                  onClick: () => handleCreateTask(meeting)
                                },
                                {
                                  label: "Delete",
                                  icon: <Trash2 className="w-4 h-4" />,
                                  onClick: () => {
                                    setMeetingToDelete(meeting.id);
                                    setShowDeleteDialog(true);
                                  },
                                  destructive: true,
                                  separator: true
                                }
                              ]}
                            />
                          </div>
                        </TableCell>
                      </TableRow>)}
              </TableBody>
            </Table>
              </div>
              
              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {sortedAndFilteredMeetings.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedAndFilteredMeetings.length)} of {sortedAndFilteredMeetings.length} meetings
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || totalPages === 0}>
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Modals */}
      <MeetingModal open={showModal} onOpenChange={setShowModal} meeting={editingMeeting} onSuccess={() => {
      fetchMeetings();
      setEditingMeeting(null);
    }} />

      <MeetingDetailModal 
        open={!!viewingMeeting} 
        onOpenChange={(open) => !open && setViewingMeeting(null)} 
        meeting={viewingMeeting}
        onEdit={(meeting) => {
          setViewingMeeting(null);
          setEditingMeeting(meeting);
          setShowModal(true);
        }}
        onUpdate={fetchMeetings}
      />

      <MeetingColumnCustomizer
        open={showColumnCustomizer}
        onOpenChange={setShowColumnCustomizer}
        columns={localColumns}
        onColumnsChange={setLocalColumns}
        onSave={saveColumns}
        isSaving={isSaving}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            if (meetingToDelete) {
              handleDelete(meetingToDelete);
              setMeetingToDelete(null);
            }
          }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedMeetings.length} Meeting(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedMeetings.length} selected meeting(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            handleBulkDelete();
            setShowBulkDeleteDialog(false);
          }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete {selectedMeetings.length} Meeting(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>;
};
export default Meetings;
