import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User, Building2, Briefcase, Calendar, CheckSquare, Users, Settings, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'lead' | 'contact' | 'deal' | 'meeting' | 'task' | 'account' | 'setting';
  route: string;
}

const typeConfig = {
  lead: { icon: User, label: 'Lead', color: 'text-blue-500' },
  contact: { icon: Users, label: 'Contact', color: 'text-green-500' },
  deal: { icon: Briefcase, label: 'Deal', color: 'text-purple-500' },
  meeting: { icon: Calendar, label: 'Meeting', color: 'text-orange-500' },
  task: { icon: CheckSquare, label: 'Task', color: 'text-yellow-500' },
  account: { icon: Building2, label: 'Account', color: 'text-cyan-500' },
  setting: { icon: Settings, label: 'Setting', color: 'text-gray-500' },
};

const settingsPages = [
  { id: 'profile', title: 'Profile Settings', subtitle: 'Manage your profile', route: '/settings?tab=account' },
  { id: 'notifications', title: 'Notification Settings', subtitle: 'Configure notifications', route: '/settings?tab=account' },
  { id: 'display', title: 'Display Settings', subtitle: 'Theme and appearance', route: '/settings?tab=account' },
  { id: 'pipeline', title: 'Pipeline Settings', subtitle: 'Manage deal stages', route: '/settings?tab=admin&section=pipeline' },
  { id: 'users', title: 'User Management', subtitle: 'Manage team members', route: '/settings?tab=admin&section=users' },
  { id: 'branding', title: 'Branding Settings', subtitle: 'Customize appearance', route: '/settings?tab=admin&section=branding' },
  { id: 'email-templates', title: 'Email Templates', subtitle: 'Manage email templates', route: '/settings?tab=email&section=templates' },
  { id: 'integrations', title: 'Integrations', subtitle: 'Connect external services', route: '/settings?tab=admin&section=integrations' },
  { id: 'page-access', title: 'Page Access Control', subtitle: 'Configure role-based access', route: '/settings?tab=admin&section=page-access' },
  { id: 'backup', title: 'Data Backup & Restore', subtitle: 'Export data and manage backups', route: '/settings?tab=admin&section=backup' },
  { id: 'audit-logs', title: 'Audit Logs', subtitle: 'View system activity', route: '/settings?tab=admin&section=audit-logs' },
  { id: 'system-status', title: 'System Status', subtitle: 'Monitor system health', route: '/settings?tab=admin&section=system-status' },
  { id: 'announcements', title: 'Announcement Management', subtitle: 'Create announcements', route: '/settings?tab=admin&section=announcements' },
  { id: 'email-history', title: 'Email History', subtitle: 'View sent emails', route: '/settings?tab=email&section=history' },
  { id: 'email-analytics', title: 'Email Analytics', subtitle: 'Email engagement stats', route: '/settings?tab=email&section=analytics' },
];

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const searchTerm = `%${searchQuery.toLowerCase()}%`;
    const allResults: SearchResult[] = [];

    try {
      // Search leads
      const { data: leads } = await supabase
        .from('leads')
        .select('id, lead_name, company_name, email')
        .or(`lead_name.ilike.${searchTerm},company_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (leads) {
        allResults.push(...leads.map(l => ({
          id: l.id,
          title: l.lead_name,
          subtitle: l.company_name || l.email || undefined,
          type: 'lead' as const,
          route: `/leads?viewId=${l.id}`,
        })));
      }

      // Search contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, contact_name, company_name, email')
        .or(`contact_name.ilike.${searchTerm},company_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (contacts) {
        allResults.push(...contacts.map(c => ({
          id: c.id,
          title: c.contact_name,
          subtitle: c.company_name || c.email || undefined,
          type: 'contact' as const,
          route: `/contacts?viewId=${c.id}`,
        })));
      }

      // Search deals
      const { data: deals } = await supabase
        .from('deals')
        .select('id, deal_name, customer_name, stage')
        .or(`deal_name.ilike.${searchTerm},customer_name.ilike.${searchTerm},project_name.ilike.${searchTerm}`)
        .limit(5);

      if (deals) {
        allResults.push(...deals.map(d => ({
          id: d.id,
          title: d.deal_name,
          subtitle: d.customer_name || d.stage || undefined,
          type: 'deal' as const,
          route: `/deals?viewId=${d.id}`,
        })));
      }

      // Search accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, company_name, industry, email')
        .or(`company_name.ilike.${searchTerm},industry.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (accounts) {
        allResults.push(...accounts.map(a => ({
          id: a.id,
          title: a.company_name,
          subtitle: a.industry || a.email || undefined,
          type: 'account' as const,
          route: `/accounts?viewId=${a.id}`,
        })));
      }

      // Search meetings
      const { data: meetings } = await supabase
        .from('meetings')
        .select('id, subject, description')
        .or(`subject.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      if (meetings) {
        allResults.push(...meetings.map(m => ({
          id: m.id,
          title: m.subject,
          subtitle: m.description?.substring(0, 50) || undefined,
          type: 'meeting' as const,
          route: `/meetings?viewId=${m.id}`,
        })));
      }

      // Search tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, description, status')
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      if (tasks) {
        allResults.push(...tasks.map(t => ({
          id: t.id,
          title: t.title,
          subtitle: t.status || t.description?.substring(0, 50) || undefined,
          type: 'task' as const,
          route: `/tasks?viewId=${t.id}`,
        })));
      }

      // Search settings (static)
      const matchedSettings = settingsPages.filter(
        s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             s.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
      );
      allResults.push(...matchedSettings.map(s => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        type: 'setting' as const,
        route: s.route,
      })));

      setResults(allResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.route);
    setQuery('');
    setIsOpen(false);
    setResults([]);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search anything..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-8 h-9 bg-muted/50 border-border/50 focus:bg-background"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (query || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : results.length === 0 && query ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {Object.entries(groupedResults).map(([type, items]) => {
                const config = typeConfig[type as keyof typeof typeConfig];
                const Icon = config.icon;
                
                  return (
                    <div key={type}>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-popover sticky top-0 z-10 border-b border-border/50">
                        {config.label}s
                      </div>
                    {items.map((result, idx) => {
                      const globalIndex = results.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            "w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-accent transition-colors",
                            globalIndex === selectedIndex && "bg-accent"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
