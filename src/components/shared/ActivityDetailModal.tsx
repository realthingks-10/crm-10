import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  User,
  Briefcase,
  Clock,
  Video,
  UserPlus,
  MapPin,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'activity' | 'contact' | 'deal' | 'lead' | 'meeting';
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, string>;
}

interface ActivityDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityItem | null;
}

const getActivityIcon = (type: string, activityType?: string) => {
  if (type === 'activity' && activityType) {
    switch (activityType) {
      case 'call': return <Phone className="h-5 w-5" />;
      case 'email': return <Mail className="h-5 w-5" />;
      case 'meeting': return <Calendar className="h-5 w-5" />;
      case 'note': return <FileText className="h-5 w-5" />;
      case 'task': return <CheckSquare className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  }
  
  switch (type) {
    case 'contact': return <User className="h-5 w-5" />;
    case 'deal': return <Briefcase className="h-5 w-5" />;
    case 'lead': return <UserPlus className="h-5 w-5" />;
    case 'meeting': return <Video className="h-5 w-5" />;
    default: return <Clock className="h-5 w-5" />;
  }
};

const getTypeColor = (type: string, activityType?: string) => {
  if (type === 'activity' && activityType) {
    switch (activityType) {
      case 'call': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'email': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
      case 'meeting': return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
      case 'note': return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
      case 'task': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  }
  
  switch (type) {
    case 'contact': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300';
    case 'deal': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
    case 'lead': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    case 'meeting': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
};

const getTypeLabel = (type: string, activityType?: string) => {
  if (type === 'activity' && activityType) {
    return activityType.charAt(0).toUpperCase() + activityType.slice(1);
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const ActivityDetailModal = ({
  open,
  onOpenChange,
  activity,
}: ActivityDetailModalProps) => {
  if (!activity) return null;

  const activityType = activity.metadata?.type;
  const icon = getActivityIcon(activity.type, activityType);
  const colorClass = getTypeColor(activity.type, activityType);
  const typeLabel = getTypeLabel(activity.type, activityType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${colorClass}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">{activity.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize">
                  {typeLabel}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(activity.date), 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {activity.description && (
            <Card>
              <CardContent className="pt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                <p className="text-sm whitespace-pre-wrap">{activity.description}</p>
              </CardContent>
            </Card>
          )}

          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Details</h4>
                <div className="space-y-2">
                  {activity.metadata.type && activity.type === 'activity' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline" className="capitalize">{activity.metadata.type}</Badge>
                    </div>
                  )}
                  {activity.metadata.outcome && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Outcome</span>
                      <span>{activity.metadata.outcome}</span>
                    </div>
                  )}
                  {activity.metadata.status && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className="capitalize">{activity.metadata.status}</Badge>
                    </div>
                  )}
                  {activity.metadata.stage && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stage</span>
                      <Badge variant="outline">{activity.metadata.stage}</Badge>
                    </div>
                  )}
                  {activity.metadata.email && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <span className="text-primary">{activity.metadata.email}</span>
                    </div>
                  )}
                  {activity.metadata.duration && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{activity.metadata.duration} min</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(activity.date), 'EEEE, dd MMMM yyyy \'at\' HH:mm')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
