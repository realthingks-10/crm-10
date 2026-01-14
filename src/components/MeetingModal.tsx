import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Video, Loader2, CalendarIcon, XCircle, X, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MeetingOutcomeSelect } from "@/components/meetings/MeetingOutcomeSelect";
import { MeetingConflictWarning } from "@/components/meetings/MeetingConflictWarning";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getMeetingStatus } from "@/utils/meetingStatus";


// Comprehensive timezones (40 options, ordered by GMT offset)
const TIMEZONES = [{
  value: "Pacific/Midway",
  label: "(GMT-11:00) Midway Island, Samoa",
  short: "GMT-11"
}, {
  value: "Pacific/Honolulu",
  label: "(GMT-10:00) Hawaii",
  short: "GMT-10"
}, {
  value: "America/Anchorage",
  label: "(GMT-09:00) Alaska",
  short: "GMT-9"
}, {
  value: "America/Los_Angeles",
  label: "(GMT-08:00) Los Angeles, San Francisco",
  short: "GMT-8"
}, {
  value: "America/Tijuana",
  label: "(GMT-08:00) Tijuana, Baja California",
  short: "GMT-8"
}, {
  value: "America/Denver",
  label: "(GMT-07:00) Denver, Phoenix",
  short: "GMT-7"
}, {
  value: "America/Phoenix",
  label: "(GMT-07:00) Arizona",
  short: "GMT-7"
}, {
  value: "America/Chicago",
  label: "(GMT-06:00) Chicago, Dallas",
  short: "GMT-6"
}, {
  value: "America/Mexico_City",
  label: "(GMT-06:00) Mexico City",
  short: "GMT-6"
}, {
  value: "America/New_York",
  label: "(GMT-05:00) New York, Washington",
  short: "GMT-5"
}, {
  value: "America/Bogota",
  label: "(GMT-05:00) Bogota, Lima",
  short: "GMT-5"
}, {
  value: "America/Caracas",
  label: "(GMT-04:00) Caracas, La Paz",
  short: "GMT-4"
}, {
  value: "America/Santiago",
  label: "(GMT-04:00) Santiago",
  short: "GMT-4"
}, {
  value: "America/Halifax",
  label: "(GMT-04:00) Atlantic Time",
  short: "GMT-4"
}, {
  value: "America/Sao_Paulo",
  label: "(GMT-03:00) Brasilia, Sao Paulo",
  short: "GMT-3"
}, {
  value: "America/Buenos_Aires",
  label: "(GMT-03:00) Buenos Aires",
  short: "GMT-3"
}, {
  value: "Atlantic/South_Georgia",
  label: "(GMT-02:00) Mid-Atlantic",
  short: "GMT-2"
}, {
  value: "Atlantic/Azores",
  label: "(GMT-01:00) Azores",
  short: "GMT-1"
}, {
  value: "Atlantic/Cape_Verde",
  label: "(GMT-01:00) Cape Verde",
  short: "GMT-1"
}, {
  value: "UTC",
  label: "(GMT+00:00) UTC",
  short: "UTC"
}, {
  value: "Europe/London",
  label: "(GMT+00:00) London, Dublin",
  short: "GMT+0"
}, {
  value: "Africa/Casablanca",
  label: "(GMT+00:00) Casablanca",
  short: "GMT+0"
}, {
  value: "Europe/Berlin",
  label: "(GMT+01:00) Berlin, Vienna, Rome",
  short: "GMT+1"
}, {
  value: "Europe/Paris",
  label: "(GMT+01:00) Paris, Brussels, Madrid",
  short: "GMT+1"
}, {
  value: "Africa/Lagos",
  label: "(GMT+01:00) West Central Africa",
  short: "GMT+1"
}, {
  value: "Europe/Athens",
  label: "(GMT+02:00) Athens, Bucharest",
  short: "GMT+2"
}, {
  value: "Africa/Cairo",
  label: "(GMT+02:00) Cairo",
  short: "GMT+2"
}, {
  value: "Africa/Johannesburg",
  label: "(GMT+02:00) Johannesburg",
  short: "GMT+2"
}, {
  value: "Europe/Moscow",
  label: "(GMT+03:00) Moscow, St. Petersburg",
  short: "GMT+3"
}, {
  value: "Asia/Kuwait",
  label: "(GMT+03:00) Kuwait, Riyadh, Baghdad",
  short: "GMT+3"
}, {
  value: "Africa/Nairobi",
  label: "(GMT+03:00) Nairobi",
  short: "GMT+3"
}, {
  value: "Asia/Tehran",
  label: "(GMT+03:30) Tehran",
  short: "GMT+3:30"
}, {
  value: "Asia/Dubai",
  label: "(GMT+04:00) Dubai, Abu Dhabi",
  short: "GMT+4"
}, {
  value: "Asia/Kabul",
  label: "(GMT+04:30) Kabul",
  short: "GMT+4:30"
}, {
  value: "Asia/Karachi",
  label: "(GMT+05:00) Islamabad, Karachi",
  short: "GMT+5"
}, {
  value: "Asia/Kolkata",
  label: "(GMT+05:30) Chennai, Kolkata, Mumbai",
  short: "GMT+5:30"
}, {
  value: "Asia/Kathmandu",
  label: "(GMT+05:45) Kathmandu",
  short: "GMT+5:45"
}, {
  value: "Asia/Dhaka",
  label: "(GMT+06:00) Dhaka, Almaty",
  short: "GMT+6"
}, {
  value: "Asia/Yangon",
  label: "(GMT+06:30) Yangon",
  short: "GMT+6:30"
}, {
  value: "Asia/Bangkok",
  label: "(GMT+07:00) Bangkok, Hanoi",
  short: "GMT+7"
}, {
  value: "Asia/Singapore",
  label: "(GMT+08:00) Singapore, Kuala Lumpur",
  short: "GMT+8"
}, {
  value: "Asia/Hong_Kong",
  label: "(GMT+08:00) Hong Kong, Beijing",
  short: "GMT+8"
}, {
  value: "Asia/Tokyo",
  label: "(GMT+09:00) Tokyo, Seoul",
  short: "GMT+9"
}, {
  value: "Australia/Darwin",
  label: "(GMT+09:30) Darwin, Adelaide",
  short: "GMT+9:30"
}, {
  value: "Australia/Sydney",
  label: "(GMT+10:00) Sydney, Melbourne",
  short: "GMT+10"
}, {
  value: "Pacific/Guam",
  label: "(GMT+10:00) Guam, Port Moresby",
  short: "GMT+10"
}, {
  value: "Pacific/Noumea",
  label: "(GMT+11:00) Magadan, Solomon Islands",
  short: "GMT+11"
}, {
  value: "Pacific/Auckland",
  label: "(GMT+12:00) Auckland, Wellington",
  short: "GMT+12"
}, {
  value: "Pacific/Fiji",
  label: "(GMT+12:00) Fiji, Marshall Islands",
  short: "GMT+12"
}, {
  value: "Pacific/Tongatapu",
  label: "(GMT+13:00) Nuku'alofa",
  short: "GMT+13"
}];

// Duration options (in minutes)
const DURATION_OPTIONS = [{
  value: "15",
  label: "15 min"
}, {
  value: "30",
  label: "30 min"
}, {
  value: "45",
  label: "45 min"
}, {
  value: "60",
  label: "1 hour"
}, {
  value: "90",
  label: "1.5 hours"
}, {
  value: "120",
  label: "2 hours"
}, {
  value: "180",
  label: "3 hours"
}, {
  value: "240",
  label: "4 hours"
}];

// Generate 15-minute time slots
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};
const TIME_SLOTS = generateTimeSlots();

// Get browser timezone
const getBrowserTimezone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Check if it exists in our list
    if (TIMEZONES.some(t => t.value === tz)) {
      return tz;
    }
    return "Asia/Kolkata"; // Fallback
  } catch {
    return "Asia/Kolkata";
  }
};
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
  status: string;
  outcome?: string | null;
  notes?: string | null;
}
interface Lead {
  id: string;
  lead_name: string;
  email?: string;
}
interface Contact {
  id: string;
  contact_name: string;
  email?: string;
}
interface MeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting?: Meeting | null;
  onSuccess: () => void;
  initialLeadId?: string;
  initialContactId?: string;
}
export const MeetingModal = ({
  open,
  onOpenChange,
  meeting,
  onSuccess,
  initialLeadId,
  initialContactId
}: MeetingModalProps) => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [creatingTeamsMeeting, setCreatingTeamsMeeting] = useState(false);
  const [cancellingMeeting, setCancellingMeeting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showParticipantsInput, setShowParticipantsInput] = useState(false);

  // State for date/time selection
  const [timezone, setTimezone] = useState(getBrowserTimezone);
  const [tzPopoverOpen, setTzPopoverOpen] = useState(false);
  const [tzTooltipOpen, setTzTooltipOpen] = useState(false);
  const tzListRef = useRef<HTMLDivElement | null>(null);
  const timeListRef = useRef<HTMLDivElement | null>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [endTimePopoverOpen, setEndTimePopoverOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [durationMode, setDurationMode] = useState<'duration' | 'endTime'>('duration');

  // Auto-calculate duration when end time changes
  const calculateDurationFromTimes = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    // Handle crossing midnight
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }
    return endMinutes - startMinutes;
  };

  // Update end time when start time or duration changes
  const updateEndTimeFromDuration = (start: string, dur: number) => {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + dur;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  // When end time is manually changed, auto-calculate duration
  const handleEndTimeChange = (newEndTime: string) => {
    setEndTime(newEndTime);
    setDurationMode('endTime');
    const calculatedDuration = calculateDurationFromTimes(startTime, newEndTime);
    if (calculatedDuration > 0) {
      setDuration(calculatedDuration.toString());
    }
  };

  // When duration is changed, update end time
  const handleDurationChange = (newDuration: string) => {
    setDuration(newDuration);
    setDurationMode('duration');
    const newEndTime = updateEndTimeFromDuration(startTime, parseInt(newDuration));
    setEndTime(newEndTime);
  };

  // When start time changes, update end time based on current duration
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    const newEndTime = updateEndTimeFromDuration(newStartTime, parseInt(duration));
    setEndTime(newEndTime);
  };
  useEffect(() => {
    if (!tzPopoverOpen) return;

    // After popover mounts, scroll the selected timezone into view.
    const raf = requestAnimationFrame(() => {
      const selectedEl = tzListRef.current?.querySelector(`[data-tz="${timezone}"]`) as HTMLElement | null;
      selectedEl?.scrollIntoView({
        block: "center"
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [tzPopoverOpen, timezone]);

  // Toggle for Lead vs Contact selection
  const [linkType, setLinkType] = useState<'lead' | 'contact'>('lead');

  // Multiple email addresses for external participants
  const [participants, setParticipants] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    join_url: "",
    lead_id: "",
    contact_id: "",
    status: "scheduled",
    outcome: ""
  });

  // Handle timezone change
  const handleTimezoneChange = (newTimezone: string) => {
    if (startDate && startTime) {
      const [h, m] = startTime.split(":").map(Number);
      const dateInOldTz = new Date(startDate);
      dateInOldTz.setHours(h, m, 0, 0);
      const utcTime = fromZonedTime(dateInOldTz, timezone);
      const timeInNewTz = toZonedTime(utcTime, newTimezone);
      setStartDate(timeInNewTz);
      setStartTime(format(timeInNewTz, "HH:mm"));
    }
    setTimezone(newTimezone);
    setTzPopoverOpen(false);
  };

  // Get current date/time for validation
  const now = new Date();
  const nowInTimezone = toZonedTime(now, timezone);
  const todayInTimezone = new Date(nowInTimezone.getFullYear(), nowInTimezone.getMonth(), nowInTimezone.getDate());

  // Filter time slots to exclude past times for today
  const getAvailableTimeSlots = (selectedDate: Date | undefined) => {
    if (!selectedDate) return TIME_SLOTS;
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const isToday = selectedDateOnly.getTime() === todayInTimezone.getTime();
    if (!isToday) return TIME_SLOTS;
    const currentHour = nowInTimezone.getHours();
    const currentMinute = nowInTimezone.getMinutes();
    return TIME_SLOTS.filter(slot => {
      const [h, m] = slot.split(":").map(Number);
      if (h > currentHour) return true;
      if (h === currentHour && m > currentMinute) return true;
      return false;
    });
  };
  const availableStartTimeSlots = useMemo(() => getAvailableTimeSlots(startDate), [startDate, timezone, nowInTimezone]);

  // Scroll to selected/current time when time popover opens
  useEffect(() => {
    if (!timePopoverOpen) return;

    const raf = requestAnimationFrame(() => {
      // Try to scroll to selected time first, otherwise scroll to first available slot
      const selectedEl = timeListRef.current?.querySelector(`[data-time="${startTime}"]`) as HTMLElement | null;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "center" });
      } else if (availableStartTimeSlots.length > 0) {
        const firstAvailable = timeListRef.current?.querySelector(`[data-time="${availableStartTimeSlots[0]}"]`) as HTMLElement | null;
        firstAvailable?.scrollIntoView({ block: "start" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [timePopoverOpen, startTime, availableStartTimeSlots]);

  // Calculate end time based on start time and duration
  const calculateEndDateTime = (start: Date, time: string, durationMinutes: number) => {
    const [h, m] = time.split(":").map(Number);
    const endDateTime = new Date(start);
    endDateTime.setHours(h, m, 0, 0);
    endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);
    return endDateTime;
  };

  // Compute proposed meeting times for conflict detection
  const proposedStartTime = useMemo(() => {
    if (!startDate || Number.isNaN(startDate.getTime())) return "";

    const [h, m] = startTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";

    const dt = new Date(startDate);
    dt.setHours(h, m, 0, 0);

    const utcTime = fromZonedTime(dt, timezone);
    return Number.isNaN(utcTime.getTime()) ? "" : utcTime.toISOString();
  }, [startDate, startTime, timezone]);

  const proposedEndTime = useMemo(() => {
    if (!startDate || Number.isNaN(startDate.getTime())) return "";

    const [h, m] = endTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";

    const dt = new Date(startDate);
    dt.setHours(h, m, 0, 0);

    // Handle crossing midnight
    const [startH, startM] = startTime.split(":").map(Number);
    if (!Number.isNaN(startH) && !Number.isNaN(startM)) {
      if (h < startH || (h === startH && m < startM)) {
        dt.setDate(dt.getDate() + 1);
      }
    }

    const utcTime = fromZonedTime(dt, timezone);
    return Number.isNaN(utcTime.getTime()) ? "" : utcTime.toISOString();
  }, [startDate, startTime, endTime, timezone]);
  useEffect(() => {
    const initializeModal = async () => {
      if (open) {
        // Fetch leads and contacts first before setting form data
        await fetchLeadsAndContacts();
        
        if (meeting) {
          const start = new Date(meeting.start_time);
          const end = new Date(meeting.end_time);

          const startValid = !Number.isNaN(start.getTime());
          const endValid = !Number.isNaN(end.getTime());

          const safeStartDate = startValid ? start : toZonedTime(new Date(), timezone);
          setStartDate(safeStartDate);
          setStartTime(startValid ? format(start, "HH:mm") : "09:00");
          setEndTime(endValid ? format(end, "HH:mm") : "10:00");

          const durationMs = startValid && endValid ? end.getTime() - start.getTime() : 60 * 60 * 1000;
          const durationMinutes = Math.max(15, Math.round(durationMs / (1000 * 60)));

          setDuration(durationMinutes.toString());
          setDurationMode('duration');
          setFormData({
            subject: meeting.subject || "",
            description: meeting.description || "",
            join_url: meeting.join_url || "",
            lead_id: meeting.lead_id || "",
            contact_id: meeting.contact_id || "",
            status: meeting.status || "scheduled",
            outcome: meeting.outcome || ""
          });
          if (meeting.lead_id) {
            setLinkType('lead');
          } else if (meeting.contact_id) {
            setLinkType('contact');
          }
          if (meeting.attendees && Array.isArray(meeting.attendees)) {
            const existingEmails = (meeting.attendees as {
              email: string;
            }[]).map(a => a.email).filter(Boolean);
            setParticipants(existingEmails);
            if (existingEmails.length > 0) setShowParticipantsInput(true);
          } else {
            setParticipants([]);
          }
        } else {
          // Default: next available 30-min slot in user's timezone
          const browserTz = getBrowserTimezone();
          const nowInTz = toZonedTime(new Date(), browserTz);
          const currentHour = nowInTz.getHours();
          const currentMinutes = nowInTz.getMinutes();
          
          // Calculate next 30-minute slot (either :00 or :30)
          const defaultStart = new Date(nowInTz);
          defaultStart.setSeconds(0, 0);
          
          if (currentMinutes < 30) {
            // Next slot is :30 of current hour
            defaultStart.setMinutes(30);
          } else {
            // Next slot is :00 of next hour
            defaultStart.setHours(currentHour + 1, 0);
          }
          
          setStartDate(defaultStart);
          setStartTime(format(defaultStart, "HH:mm"));
          setDuration("30");
          setEndTime(updateEndTimeFromDuration(format(defaultStart, "HH:mm"), 30));
          setDurationMode('duration');
          setTimezone(getBrowserTimezone());
          // Set initial link type based on passed props
          if (initialContactId) {
            setLinkType('contact');
          } else if (initialLeadId) {
            setLinkType('lead');
          } else {
            setLinkType('lead');
          }
          setParticipants([]);
          setEmailInput("");
          setShowParticipantsInput(false);
          setFormData({
            subject: "",
            description: "",
            join_url: "",
            lead_id: initialLeadId || "",
            contact_id: initialContactId || "",
            status: "scheduled",
            outcome: ""
          });
        }
      }
    };
    
    initializeModal();
  }, [open, meeting]);
  const fetchLeadsAndContacts = async () => {
    try {
      const [leadsRes, contactsRes] = await Promise.all([supabase.from('leads').select('id, lead_name, email').order('lead_name'), supabase.from('contacts').select('id, contact_name, email').order('contact_name')]);
      if (leadsRes.data) setLeads(leadsRes.data);
      if (contactsRes.data) setContacts(contactsRes.data);
    } catch (error) {
      console.error('Error fetching leads/contacts:', error);
    }
  };
  const buildISODateTime = (date: Date | undefined, time: string): string => {
    if (!date || Number.isNaN(date.getTime())) return "";

    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";

    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);

    const utcTime = fromZonedTime(dt, timezone);
    return Number.isNaN(utcTime.getTime()) ? "" : utcTime.toISOString();
  };

  const buildEndISODateTime = (date: Date | undefined, endTimeStr: string): string => {
    if (!date || Number.isNaN(date.getTime())) return "";

    const [h, m] = endTimeStr.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";

    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);

    // Handle crossing midnight
    const [startH, startM] = startTime.split(":").map(Number);
    if (!Number.isNaN(startH) && !Number.isNaN(startM)) {
      if (h < startH || (h === startH && m < startM)) {
        dt.setDate(dt.getDate() + 1);
      }
    }

    const utcTime = fromZonedTime(dt, timezone);
    return Number.isNaN(utcTime.getTime()) ? "" : utcTime.toISOString();
  };
  const createTeamsMeeting = async () => {
    if (!formData.subject || !startDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in meeting title and date/time",
        variant: "destructive"
      });
      return;
    }
    setCreatingTeamsMeeting(true);
    try {
      const attendees: {
        email: string;
        name: string;
      }[] = [];
      if (linkType === 'lead' && formData.lead_id) {
        const lead = leads.find(l => l.id === formData.lead_id);
        if (lead?.email) {
          attendees.push({
            email: lead.email,
            name: lead.lead_name
          });
        }
      } else if (linkType === 'contact' && formData.contact_id) {
        const contact = contacts.find(c => c.id === formData.contact_id);
        if (contact?.email) {
          attendees.push({
            email: contact.email,
            name: contact.contact_name
          });
        }
      }
      participants.forEach(email => {
        if (email && !attendees.some(a => a.email === email)) {
          attendees.push({
            email,
            name: email.split('@')[0]
          });
        }
      });
      const {
        data,
        error
      } = await supabase.functions.invoke('create-teams-meeting', {
        body: {
          subject: formData.subject,
          attendees,
          startTime: buildISODateTime(startDate, startTime),
          endTime: buildEndISODateTime(startDate, endTime),
          timezone,
          description: formData.description
        }
      });
      if (error) throw error;
      if (data?.meeting?.joinUrl) {
        setFormData(prev => ({
          ...prev,
          join_url: data.meeting.joinUrl
        }));
        toast({
          title: "Teams Meeting Created",
          description: "Meeting link has been generated"
        });
        return data.meeting.joinUrl;
      }
      return null;
    } catch (error: any) {
      console.error('Error creating Teams meeting:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Teams meeting",
        variant: "destructive"
      });
      return null;
    } finally {
      setCreatingTeamsMeeting(false);
    }
  };
  const handleSubmit = async (
    e: React.FormEvent,
    joinUrlOverride?: string | null,
    options?: { forceInsert?: boolean; syncTeams?: boolean }
  ) => {
    e.preventDefault();
    if (!formData.subject || !startDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate: must have related record or participants
    const hasRelatedRecord =
      (linkType === "lead" && formData.lead_id) ||
      (linkType === "contact" && formData.contact_id);
    if (!hasRelatedRecord && participants.length === 0) {
      toast({
        title: "Missing attendees",
        description: "Please select a Lead/Contact or add external participants",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const joinUrl = joinUrlOverride ?? formData.join_url ?? null;

      // Build attendees payload for Teams update (lead/contact + external participants)
      const attendeesPayload: { email: string; name: string }[] = [];
      if (linkType === "lead" && formData.lead_id) {
        const lead = leads.find((l) => l.id === formData.lead_id);
        if (lead?.email) {
          attendeesPayload.push({ email: lead.email, name: lead.lead_name });
        }
      } else if (linkType === "contact" && formData.contact_id) {
        const contact = contacts.find((c) => c.id === formData.contact_id);
        if (contact?.email) {
          attendeesPayload.push({ email: contact.email, name: contact.contact_name });
        }
      }
      participants.forEach((email) => {
        if (email && !attendeesPayload.some((a) => a.email === email)) {
          attendeesPayload.push({ email, name: email.split("@")[0] });
        }
      });

      const isUpdate = !!(meeting?.id && meeting.id.trim() !== "") && !options?.forceInsert;

      const meetingData = {
        subject: formData.subject,
        description: formData.description || null,
        start_time: buildISODateTime(startDate, startTime),
        end_time: buildEndISODateTime(startDate, endTime),
        join_url: joinUrl,
        lead_id:
          linkType === "lead" && formData.lead_id && formData.lead_id.trim() !== ""
            ? formData.lead_id
            : null,
        contact_id:
          linkType === "contact" && formData.contact_id && formData.contact_id.trim() !== ""
            ? formData.contact_id
            : null,
        attendees:
          participants.length > 0
            ? participants.map((email) => ({ email, name: email.split("@")[0] }))
            : null,
        status: options?.forceInsert ? "scheduled" : formData.status,
        outcome: formData.outcome || null,
      };

      // Sync updates back to Teams/Outlook (existing meetings only)
      if (isUpdate && options?.syncTeams && joinUrl) {
        const { error: teamsError } = await supabase.functions.invoke("update-teams-meeting", {
          body: {
            meetingId: meeting!.id,
            joinUrl,
            subject: meetingData.subject,
            attendees: attendeesPayload,
            startTime: meetingData.start_time,
            endTime: meetingData.end_time,
            timezone,
            description: formData.description || "",
          },
        });
        if (teamsError) throw teamsError;
      }

      if (isUpdate) {
        const { error } = await supabase
          .from("meetings")
          .update(meetingData)
          .eq("id", meeting!.id);
        if (error) throw error;
        toast({ title: "Success", description: "Meeting saved" });
      } else {
        const { error } = await supabase
          .from("meetings")
          .insert([{ ...meetingData, created_by: user?.id }]);
        if (error) throw error;
        toast({ title: "Success", description: "Meeting created" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save meeting",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const handleCancelMeeting = async () => {
    if (!meeting?.id || !meeting?.join_url) {
      toast({
        title: "Cannot cancel",
        description: "No Teams meeting link found for this meeting",
        variant: "destructive"
      });
      return;
    }
    setCancellingMeeting(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('cancel-teams-meeting', {
        body: {
          meetingId: meeting.id,
          joinUrl: meeting.join_url
        }
      });
      if (error) throw error;
      const {
        error: updateError
      } = await supabase.from('meetings').update({
        status: 'cancelled'
      }).eq('id', meeting.id);
      if (updateError) throw updateError;
      toast({
        title: "Meeting Cancelled",
        description: "The Teams meeting has been cancelled"
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error cancelling meeting:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel meeting",
        variant: "destructive"
      });
    } finally {
      setCancellingMeeting(false);
    }
  };
  const formatDisplayTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };
  const addParticipant = () => {
    const email = emailInput.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !participants.includes(email)) {
      setParticipants(prev => [...prev, email]);
      setEmailInput("");
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
    }
  };
  const selectedTimezone = TIMEZONES.find(tz => tz.value === timezone);

  const isPersistedMeeting = !!(meeting?.id && meeting.id.trim() !== "");
  const effectiveStatus = meeting ? getMeetingStatus(meeting) : "scheduled";
  const canCancel =
    isPersistedMeeting &&
    !!meeting?.join_url &&
    (effectiveStatus === "scheduled" || effectiveStatus === "ongoing");

  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-base font-semibold">
            {isPersistedMeeting ? "Edit Meeting" : "New Meeting"}
          </DialogTitle>
          <DialogDescription className="sr-only">Schedule a meeting with participants</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Organizer Info */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">Meeting Organizer:</Label>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You'}
            </div>
          </div>

          {/* Meeting Subject/Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Subject *</Label>
            <Input
              placeholder="e.g., Project kickoff meeting"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>

          {/* Timezone, Date, Time & Duration Row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Timezone</Label>
              <TooltipProvider>
                <Popover open={tzPopoverOpen} onOpenChange={open => {
                  setTzPopoverOpen(open);
                  if (open) setTzTooltipOpen(false);
                }}>
                  <Tooltip open={!tzPopoverOpen && tzTooltipOpen}>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full h-8 justify-start text-left font-normal text-xs gap-1.5"
                          onMouseEnter={() => setTzTooltipOpen(true)}
                          onMouseLeave={() => setTzTooltipOpen(false)}
                          onFocus={() => setTzTooltipOpen(false)}
                          onBlur={() => setTzTooltipOpen(false)}
                          onClick={() => setTzTooltipOpen(false)}
                        >
                          <span className="truncate">{selectedTimezone?.short || timezone}</span>
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={5}>
                      <p>{selectedTimezone?.label || timezone}</p>
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-72 p-0" align="start">
                    <div ref={tzListRef} className="max-h-60 overflow-y-auto overscroll-contain pointer-events-auto p-1" onWheelCapture={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
                      {TIMEZONES.map(tz => <Button key={tz.value} data-tz={tz.value} variant={timezone === tz.value ? "secondary" : "ghost"} className="w-full justify-start text-xs h-7 font-normal" onClick={() => handleTimezoneChange(tz.value)}>
                          {tz.label}
                        </Button>)}
                    </div>
                  </PopoverContent>
                </Popover>
              </TooltipProvider>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date *</Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-8 justify-start text-left font-normal text-xs", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {startDate ? format(startDate, "dd MMM") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={date => {
                  setStartDate(date);
                  setDatePopoverOpen(false);
                }} disabled={date => date < todayInTimezone} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start *</Label>
              <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-8 justify-start text-left font-normal text-xs">
                    {formatDisplayTime(startTime)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-28 p-1 z-50 pointer-events-auto" align="start">
                  <div
                    ref={timeListRef}
                    className="max-h-48 overflow-y-auto overscroll-contain pointer-events-auto flex flex-col"
                    onWheelCapture={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    {availableStartTimeSlots.length > 0 ? (
                      availableStartTimeSlots.map((slot) => (
                        <Button
                          key={slot}
                          data-time={slot}
                          variant={startTime === slot ? "secondary" : "ghost"}
                          className="w-full justify-start text-xs h-7"
                          onClick={() => {
                            handleStartTimeChange(slot);
                            setTimePopoverOpen(false);
                          }}
                        >
                          {formatDisplayTime(slot)}
                        </Button>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground p-2">No times available</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Duration *</Label>
              <Select value={duration} onValueChange={handleDurationChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select duration..." />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conflict Warning */}
          {proposedStartTime && proposedEndTime && <MeetingConflictWarning startTime={proposedStartTime} endTime={proposedEndTime} excludeMeetingId={meeting?.id} />}

          {/* Related To */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Related To *</Label>
              <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setShowParticipantsInput(!showParticipantsInput)}>
                <Plus className="h-3 w-3" />
                Add Participants
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted rounded p-0.5 shrink-0">
                <Button type="button" variant={linkType === 'lead' ? 'secondary' : 'ghost'} size="sm" onClick={() => {
                setLinkType('lead');
                setFormData(prev => ({
                  ...prev,
                  contact_id: ''
                }));
              }} className="h-6 px-2.5 text-xs">
                  Lead
                </Button>
                <Button type="button" variant={linkType === 'contact' ? 'secondary' : 'ghost'} size="sm" onClick={() => {
                setLinkType('contact');
                setFormData(prev => ({
                  ...prev,
                  lead_id: ''
                }));
              }} className="h-6 px-2.5 text-xs">
                  Contact
                </Button>
              </div>
              
              <div className="flex-1">
                {linkType === 'lead' ? <Select value={formData.lead_id} onValueChange={value => setFormData(prev => ({
                ...prev,
                lead_id: value === "none" ? "" : value
              }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select a lead" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">None</SelectItem>
                      {leads.map(lead => <SelectItem key={lead.id} value={lead.id} className="text-xs">
                          {lead.lead_name}{lead.email ? ` (${lead.email})` : ''}
                        </SelectItem>)}
                    </SelectContent>
                  </Select> : <Select value={formData.contact_id} onValueChange={value => setFormData(prev => ({
                ...prev,
                contact_id: value === "none" ? "" : value
              }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select a contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">None</SelectItem>
                      {contacts.map(contact => <SelectItem key={contact.id} value={contact.id} className="text-xs">
                          {contact.contact_name}{contact.email ? ` (${contact.email})` : ''}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>}
              </div>
            </div>
          </div>

          {/* Participants - Collapsible */}
          {showParticipantsInput && <div className="space-y-1.5 border-l-2 border-muted pl-3">
              <Label className="text-xs font-medium">External Participants</Label>
              <div className="flex gap-1.5">
                <Input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="email@example.com" className="h-7 text-xs" onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addParticipant();
              }
            }} />
                <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={addParticipant}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {participants.length > 0 && <div className="flex flex-wrap gap-1">
                  {participants.map((email, index) => <Badge key={index} variant="secondary" className="gap-0.5 pr-0.5 text-xs h-5">
                      {email}
                      <button type="button" onClick={() => setParticipants(prev => prev.filter((_, i) => i !== index))} className="ml-0.5 hover:bg-muted-foreground/20 rounded-full p-0.5">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>)}
                </div>}
            </div>}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium">Agenda</Label>
            <Textarea id="description" value={formData.description} onChange={e => setFormData(prev => ({
            ...prev,
            description: e.target.value
          }))} placeholder="Meeting agenda..." rows={2} className="text-xs resize-none min-h-[60px]" />
          </div>

          {/* Outcome - show for completed meetings based on effective status */}
          {isPersistedMeeting && effectiveStatus === 'completed' && <MeetingOutcomeSelect value={formData.outcome} onChange={value => setFormData(prev => ({
          ...prev,
          outcome: value
        }))} />}

          {/* Actions */}
          <div className="flex justify-between items-center gap-2 pt-3 border-t">
            <div>
              {canCancel && <Button type="button" variant="destructive" size="sm" disabled={cancellingMeeting || loading} onClick={handleCancelMeeting} className="gap-1 h-8 text-xs">
                  {cancellingMeeting ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                  {cancellingMeeting ? "Cancelling..." : "Cancel"}
                </Button>}
            </div>
            <div className="flex gap-2">
              {formData.join_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 text-xs"
                  asChild
                >
                  <a href={formData.join_url} target="_blank" rel="noopener noreferrer">
                    <Video className="h-3 w-3" />
                    Join
                  </a>
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
                Close
              </Button>

              <Button type="button" size="sm" className="gap-1 h-8 text-xs" disabled={loading || creatingTeamsMeeting || cancellingMeeting} onClick={async e => {
              e.preventDefault();
              if (!formData.subject || !startDate) {
                toast({
                  title: "Missing fields",
                  description: "Please fill in meeting title and date/time",
                  variant: "destructive"
                });
                return;
              }

              const isCancelled = effectiveStatus === "cancelled";
              const isCompleted = effectiveStatus === "completed";

              // Completed meetings: allow saving notes/outcome only (no Teams sync)
              if (isCompleted) {
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                await handleSubmit(fakeEvent, formData.join_url, { syncTeams: false });
                return;
              }

              let joinUrl = formData.join_url;
              let forceInsert = false;
              let syncTeams = false;

              if (isCancelled) {
                // Cancelled meeting: create a fresh Teams meeting + insert a new DB record
                joinUrl = await createTeamsMeeting();
                forceInsert = true;
              } else if (!joinUrl) {
                joinUrl = await createTeamsMeeting();
              } else {
                // Existing Teams meeting: send updates to Teams/Outlook
                syncTeams = true;
              }

              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              await handleSubmit(fakeEvent, joinUrl, { forceInsert, syncTeams });
            }}>
                {loading || creatingTeamsMeeting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />}
                {loading ? "Saving..." : creatingTeamsMeeting ? "Creating..." : effectiveStatus === "completed" ? "Save" : effectiveStatus === "cancelled" || !formData.join_url ? "Create Meeting" : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>;
};