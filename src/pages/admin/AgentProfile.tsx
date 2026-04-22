import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthenticatedUser } from '@/hooks/useAuthenticatedUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, KeyRound, BellRing, User, Coffee, Save, ArrowLeft, Camera } from 'lucide-react';

/**
 * Agent self-service profile.
 * - Agents can edit their own profile (?agent_id omitted, or matches their user_id).
 * - Admins can edit any agent by passing ?agent_id=<user_id>.
 */
const AgentProfile: React.FC = () => {
  const { user } = useAuthenticatedUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const targetUserId = params.get('agent_id') || user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSelf, setIsSelf] = useState(true);

  const [profile, setProfile] = useState<any>({ full_name: '', email: '', avatar_url: '' });
  const [agent, setAgent] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);

  // form state
  const [form, setForm] = useState({
    full_name: '',
    avatar_url: '',
    away_message: '',
    notify_new_chat: true,
    notify_assignment: true,
    notify_email: true,
    department_id: '',
    max_concurrent_chats: 5,
    status: 'offline' as 'online' | 'away' | 'offline',
  });

  // password change
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !targetUserId) return;
    setLoading(true);
    setIsSelf(user.id === targetUserId);

    const { data: adminCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' as any });
    setIsAdmin(!!adminCheck);

    if (user.id !== targetUserId && !adminCheck) {
      toast({ title: 'Not allowed', description: 'You can only edit your own profile.', variant: 'destructive' });
      navigate('/admin/support-chat');
      return;
    }

    const [{ data: prof }, { data: agentRow }, { data: depts }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, avatar_url').eq('id', targetUserId).maybeSingle(),
      (supabase.from('support_agents') as any)
        .select('*, support_departments(name)')
        .eq('user_id', targetUserId)
        .maybeSingle(),
      supabase.from('support_departments').select('id, name, is_active').order('display_order'),
    ]);

    setProfile(prof || { full_name: '', email: '', avatar_url: '' });
    setAgent(agentRow || null);
    setDepartments(depts || []);

    setForm({
      full_name: prof?.full_name || '',
      avatar_url: prof?.avatar_url || '',
      away_message: agentRow?.away_message || '',
      notify_new_chat: agentRow?.notify_new_chat ?? true,
      notify_assignment: agentRow?.notify_assignment ?? true,
      notify_email: agentRow?.notify_email ?? true,
      department_id: agentRow?.department_id || '',
      max_concurrent_chats: agentRow?.max_concurrent_chats || 5,
      status: (agentRow?.status as any) || 'offline',
    });
    setLoading(false);
  }, [user?.id, targetUserId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleAvatarUpload = async (file: File) => {
    if (!targetUserId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Avatar must be under 2 MB.', variant: 'destructive' });
      return;
    }
    const ext = file.name.split('.').pop() || 'png';
    const path = `${targetUserId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' });
      return;
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    setForm((f) => ({ ...f, avatar_url: pub.publicUrl }));
    toast({ title: 'Avatar uploaded', description: 'Save changes to apply it.' });
  };

  const saveProfile = async () => {
    if (!targetUserId) return;
    setSaving(true);
    try {
      const { error: profErr } = await supabase.from('profiles').update({
        full_name: form.full_name.trim() || null,
        avatar_url: form.avatar_url || null,
      }).eq('id', targetUserId);
      if (profErr) throw profErr;

      // Self-service fields any agent can edit
      const agentPatch: any = {
        away_message: form.away_message || null,
        notify_new_chat: form.notify_new_chat,
        notify_assignment: form.notify_assignment,
        notify_email: form.notify_email,
        status: form.status,
      };
      // Admin-only fields
      if (isAdmin) {
        agentPatch.department_id = form.department_id || null;
        agentPatch.max_concurrent_chats = Math.max(1, Math.min(50, Number(form.max_concurrent_chats) || 5));
      }

      if (agent) {
        const { error: agentErr } = await (supabase.from('support_agents') as any)
          .update(agentPatch)
          .eq('user_id', targetUserId);
        if (agentErr) throw agentErr;
      }

      toast({ title: 'Profile saved', description: 'Your changes are live.' });
      load();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!isSelf) {
      toast({ title: 'Not supported', description: 'Admins should send a reset link instead of changing passwords directly.', variant: 'destructive' });
      return;
    }
    if (pwd.next.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setPwdSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) throw error;
      toast({ title: 'Password updated' });
      setPwd({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      toast({ title: 'Could not update password', description: e?.message, variant: 'destructive' });
    } finally {
      setPwdSaving(false);
    }
  };

  const sendResetLink = async () => {
    if (!profile?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Reset link sent', description: `Email sent to ${profile.email}.` });
    } catch (e: any) {
      toast({ title: 'Could not send', description: e?.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = (form.full_name || profile.email || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/support-chat')} className="mb-2 -ml-2 h-8 text-xs">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to support
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSelf ? 'My agent profile' : `Editing: ${profile.full_name || profile.email}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSelf ? 'Manage your details, availability and security.' : 'Admin override — changes are audited.'}
          </p>
        </div>
        {isAdmin && !isSelf && (
          <Badge variant="outline" className="border-foreground/20 text-foreground">
            <ShieldCheck className="mr-1 h-3 w-3" /> Admin override
          </Badge>
        )}
      </div>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Identity
          </CardTitle>
          <CardDescription>This is what your customers and teammates will see.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-border">
              <AvatarImage src={form.avatar_url} alt={form.full_name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <Camera className="h-3.5 w-3.5" /> Upload new avatar
              </Label>
              <input
                id="avatar"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">PNG or JPG, max 2 MB.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email || ''} disabled className="bg-muted/40" />
              <p className="text-[11px] text-muted-foreground">Contact an admin to change this.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coffee className="h-4 w-4" /> Availability
          </CardTitle>
          <CardDescription>Control how your status appears in the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Current status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online — accept chats</SelectItem>
                  <SelectItem value="away">Away — paused</SelectItem>
                  <SelectItem value="offline">Offline — signed out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Max concurrent chats</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.max_concurrent_chats}
                  onChange={(e) => setForm({ ...form, max_concurrent_chats: parseInt(e.target.value) || 5 })}
                />
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                <SelectContent>
                  {departments.filter((d: any) => d.is_active).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="away">Away message</Label>
            <Textarea
              id="away"
              rows={3}
              value={form.away_message}
              onChange={(e) => setForm({ ...form, away_message: e.target.value })}
              placeholder="I'll be back at 14:00. For urgent matters, contact the billing team."
            />
            <p className="text-[11px] text-muted-foreground">Shown to teammates when your status is Away.</p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4" /> Notifications
          </CardTitle>
          <CardDescription>Choose how you'd like to be alerted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'notify_new_chat', label: 'New conversation in my department', desc: 'Get notified the moment a new chat hits the queue.' },
            { key: 'notify_assignment', label: 'Conversation assigned to me', desc: 'Tell me when a chat is routed to me directly.' },
            { key: 'notify_email', label: 'Email summaries', desc: 'Receive email recaps for assignments and escalations.' },
          ].map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.desc}</p>
              </div>
              <Switch
                checked={(form as any)[row.key]}
                onCheckedChange={(v) => setForm({ ...form, [row.key]: v } as any)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveProfile} disabled={saving} className="h-10 px-6">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </div>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Security
          </CardTitle>
          <CardDescription>Update your password or send a reset link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isSelf ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new_pwd">New password</Label>
                  <Input id="new_pwd" type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="At least 8 characters" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm_pwd">Confirm password</Label>
                  <Input id="confirm_pwd" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
                </div>
              </div>
              <Button onClick={changePassword} disabled={pwdSaving || !pwd.next} variant="outline">
                {pwdSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Update password
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4">
              <p className="text-sm font-medium">Send a password reset email</p>
              <p className="mt-1 text-xs text-muted-foreground">
                For security, only the agent themselves can choose a new password.
                Send a reset link to <span className="font-medium text-foreground">{profile.email}</span>.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={sendResetLink}>
                <KeyRound className="mr-2 h-3.5 w-3.5" /> Send reset link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentProfile;
