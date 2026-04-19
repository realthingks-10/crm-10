import { useState, useMemo, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Building2, Users, ChevronRight, ChevronDown, Linkedin, Globe, Search, ChevronsDownUp, ChevronsUpDown, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { AddAccountsModal } from "./AddAccountsModal";
import { AddContactsModal } from "./AddContactsModal";

interface Props {
  campaignId: string;
  isCampaignEnded: boolean;
  selectedRegions?: string[];
  selectedCountries?: string[];
}

const COLS = 6;

export function CampaignAudienceTable({ campaignId, isCampaignEnded, selectedRegions = [], selectedCountries = [] }: Props) {
  const queryClient = useQueryClient();
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [addContactForAccount, setAddContactForAccount] = useState<{ id: string; name: string } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ type: "account" | "contact"; id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: campaignAccounts = [] } = useQuery({
    queryKey: ["campaign-audience-accounts", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_accounts")
        .select("id, account_id, created_at, accounts(account_name, industry, region, country, website, phone)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const { data: campaignContacts = [] } = useQuery({
    queryKey: ["campaign-audience-contacts", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_contacts")
        .select("id, contact_id, account_id, contacts(contact_name, email, position, linkedin, industry, phone_no)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const existingAccountIds = useMemo(() => campaignAccounts.map((ca: any) => ca.account_id), [campaignAccounts]);
  const existingContactIds = useMemo(() => campaignContacts.map((cc: any) => cc.contact_id), [campaignContacts]);

  // Realtime sync
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-audience-accounts", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-audience-contacts", campaignId] });
    };

    const channel = supabase
      .channel(`campaign-audience-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_contacts", filter: `campaign_id=eq.${campaignId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_accounts", filter: `campaign_id=eq.${campaignId}` }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, queryClient]);

  const getContactsForAccount = (accountId: string) =>
    campaignContacts.filter((cc: any) => cc.account_id === accountId);

  const q = searchQuery.trim().toLowerCase();
  const matchContact = (cc: any) => {
    if (!q) return true;
    const c = cc.contacts || {};
    return [c.contact_name, c.email, c.position, c.industry, c.phone_no]
      .some((v: string | null) => v && v.toLowerCase().includes(q));
  };
  const matchAccount = (ca: any) => {
    if (!q) return true;
    const a = ca.accounts || {};
    if ([a.account_name, a.industry, a.region, a.country].some((v: string | null) => v && v.toLowerCase().includes(q))) return true;
    return getContactsForAccount(ca.account_id).some(matchContact);
  };

  const filteredAccounts = useMemo(() => campaignAccounts.filter(matchAccount), [campaignAccounts, campaignContacts, q]);
  const unlinkedContacts = useMemo(
    () => campaignContacts.filter((cc: any) => !cc.account_id && matchContact(cc)),
    [campaignContacts, q]
  );

  const allExpanded = filteredAccounts.length > 0 && filteredAccounts.every((ca: any) => expandedAccounts.has(ca.account_id));
  const toggleExpandAll = () => {
    if (allExpanded) setExpandedAccounts(new Set());
    else setExpandedAccounts(new Set(filteredAccounts.map((ca: any) => ca.account_id)));
  };

  const toggleExpand = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId); else next.add(accountId);
      return next;
    });
  };

  const confirmRemove = async () => {
    if (!removeConfirm) return;
    if (removeConfirm.type === "account") {
      await supabase.from("campaign_accounts").delete().eq("id", removeConfirm.id);
      queryClient.invalidateQueries({ queryKey: ["campaign-audience-accounts", campaignId] });
    } else {
      await supabase.from("campaign_contacts").delete().eq("id", removeConfirm.id);
      queryClient.invalidateQueries({ queryKey: ["campaign-audience-contacts", campaignId] });
    }
    setRemoveConfirm(null);
    toast({ title: `${removeConfirm.type === "account" ? "Account" : "Contact"} removed` });
  };

  const ContactRow = ({ cc, indented = true }: { cc: any; indented?: boolean }) => {
    const c = cc.contacts || {};
    return (
      <TableRow className="hover:bg-muted/30">
        <TableCell className={indented ? "pl-10" : ""}>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
            <span className="text-sm font-medium">{c.contact_name || "—"}</span>
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{c.position || "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {c.email ? (
            <a href={`mailto:${c.email}`} className="hover:text-primary hover:underline">{c.email}</a>
          ) : "—"}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{c.phone_no || "—"}</TableCell>
        <TableCell>
          {c.linkedin ? (
            <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline">
              <Linkedin className="h-4 w-4" />
            </a>
          ) : <span className="text-muted-foreground text-sm">—</span>}
        </TableCell>
        <TableCell>
          {!isCampaignEnded && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRemoveConfirm({ type: "contact", id: cc.id, name: c.contact_name || "this contact" })}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const totalAccounts = campaignAccounts.length;
  const totalContacts = campaignContacts.length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts & contacts…"
              className="h-8 w-64 pl-8 text-xs"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {totalAccounts} account{totalAccounts !== 1 ? "s" : ""} · {totalContacts} contact{totalContacts !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filteredAccounts.length > 0 && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={toggleExpandAll}>
              {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5 mr-1" /> : <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />}
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          )}
          {!isCampaignEnded && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAddAccountModalOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Accounts
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => { setAddContactForAccount(null); setAddContactModalOpen(true); }}>
                <Plus className="h-3 w-3 mr-1" /> Contacts
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {totalAccounts === 0 && totalContacts === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
          No accounts or contacts yet. Use the buttons above to add some.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[24%]">Contact Name</TableHead>
                <TableHead className="w-[16%]">Title</TableHead>
                <TableHead className="w-[24%]">Email</TableHead>
                <TableHead className="w-[16%]">Phone</TableHead>
                <TableHead className="w-[10%]">LinkedIn</TableHead>
                <TableHead className="w-[10%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((ca: any) => {
                const accountContacts = getContactsForAccount(ca.account_id);
                const isExpanded = expandedAccounts.has(ca.account_id);
                const a = ca.accounts || {};
                const locationParts = [a.region, a.country].filter(Boolean);
                const visibleContacts = accountContacts.filter(matchContact);
                return (
                  <Fragment key={ca.id}>
                    {/* Account banner row */}
                    <TableRow
                      className="bg-muted/40 hover:bg-muted/60 cursor-pointer border-l-2 border-l-primary/50"
                      onClick={() => toggleExpand(ca.account_id)}
                    >
                      <TableCell colSpan={COLS} className="py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <Building2 className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-semibold text-sm truncate">{a.account_name || "—"}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              {accountContacts.length} contact{accountContacts.length !== 1 ? "s" : ""}
                            </Badge>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs text-muted-foreground">{a.industry || "No industry"}</span>
                            {locationParts.length > 0 && (
                              <>
                                <span className="text-muted-foreground text-xs">·</span>
                                <span className="text-xs text-muted-foreground">{locationParts.join(" / ")}</span>
                              </>
                            )}
                            {a.phone && (
                              <>
                                <span className="text-muted-foreground text-xs">·</span>
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" /> {a.phone}
                                </span>
                              </>
                            )}
                            {a.website && (
                              <>
                                <span className="text-muted-foreground text-xs">·</span>
                                <a
                                  href={a.website.startsWith("http") ? a.website : `https://${a.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  title={a.website}
                                >
                                  <Globe className="h-3 w-3" /> Website
                                </a>
                              </>
                            )}
                          </div>
                          {!isCampaignEnded && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAddContactForAccount({ id: ca.account_id, name: a.account_name || "" });
                                  setAddContactModalOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Contact
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRemoveConfirm({ type: "account", id: ca.id, name: a.account_name || "this account" });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Contact rows */}
                    {isExpanded && (
                      visibleContacts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={COLS} className="pl-10 text-sm text-muted-foreground italic py-2">
                            No contacts from this account yet.
                            {!isCampaignEnded && (
                              <Button
                                variant="link"
                                size="sm"
                                className="ml-2 p-0 h-auto"
                                onClick={() => {
                                  setAddContactForAccount({ id: ca.account_id, name: a.account_name || "" });
                                  setAddContactModalOpen(true);
                                }}
                              >
                                Add contacts
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleContacts.map((cc: any) => <ContactRow key={cc.id} cc={cc} />)
                      )
                    )}
                  </Fragment>
                );
              })}

              {unlinkedContacts.length > 0 && (
                <>
                  <TableRow className="bg-muted/40 border-l-2 border-l-muted-foreground/40">
                    <TableCell colSpan={COLS} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Unlinked Contacts</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                          {unlinkedContacts.length}
                        </Badge>
                        <span className="text-xs text-muted-foreground italic">— not linked to any campaign account</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {unlinkedContacts.map((cc: any) => <ContactRow key={cc.id} cc={cc} />)}
                </>
              )}

              {filteredAccounts.length === 0 && unlinkedContacts.length === 0 && q && (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-center text-sm text-muted-foreground py-6">
                    No matches for "{searchQuery}".
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AddAccountsModal
        open={addAccountModalOpen}
        onOpenChange={setAddAccountModalOpen}
        campaignId={campaignId}
        selectedRegions={selectedRegions}
        selectedCountries={selectedCountries}
        existingAccountIds={existingAccountIds}
        existingContactIds={existingContactIds}
        campaignAccounts={campaignAccounts}
      />

      <AddContactsModal
        open={addContactModalOpen}
        onOpenChange={(o) => { setAddContactModalOpen(o); if (!o) setAddContactForAccount(null); }}
        campaignId={campaignId}
        forAccount={addContactForAccount}
        existingContactIds={existingContactIds}
        campaignAccounts={campaignAccounts}
        selectedCountries={selectedCountries}
      />

      <AlertDialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeConfirm?.type === "account" ? "Account" : "Contact"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removeConfirm?.name} from this campaign? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
