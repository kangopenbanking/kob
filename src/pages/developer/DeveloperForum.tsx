import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { toast } from "sonner";
import { MessageSquare, CheckCircle2, Clock, ChevronRight, ArrowLeft, Send, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "authentication", label: "Authentication" },
  { value: "payments", label: "Payments" },
  { value: "open-banking", label: "Open Banking" },
  { value: "mobile-money", label: "Mobile Money" },
  { value: "webhooks", label: "Webhooks" },
  { value: "sdks", label: "SDKs" },
  { value: "sandbox", label: "Sandbox" },
];

interface Thread {
  id: string;
  title: string;
  body: string;
  author_name: string;
  category: string;
  is_resolved: boolean;
  replies_count: number;
  created_at: string;
}

interface Reply {
  id: string;
  body: string;
  author_name: string;
  is_accepted_answer: boolean;
  created_at: string;
}

export default function DeveloperForum() {
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [newThread, setNewThread] = useState({ title: "", body: "", category: "general", author_name: "" });
  const [newReply, setNewReply] = useState({ body: "", author_name: "" });

  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["forum-threads", filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("forum_threads")
        .select("*")
        .order("created_at", { ascending: false });
      if (filterCategory !== "all") {
        query = query.eq("category", filterCategory);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Thread[];
    },
  });

  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ["forum-replies", selectedThread],
    enabled: !!selectedThread,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_replies")
        .select("*")
        .eq("thread_id", selectedThread!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Reply[];
    },
  });

  const createThread = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.from("forum_threads").insert({
        title: newThread.title,
        body: newThread.body,
        category: newThread.category,
        author_name: newThread.author_name || "Anonymous Developer",
        user_id: session.session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      setNewThread({ title: "", body: "", category: "general", author_name: "" });
      setShowNewThread(false);
      toast.success("Thread created successfully.");
    },
    onError: (err: Error) => toast.error(extractEdgeFunctionError(err)),
  });

  const createReply = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.from("forum_replies").insert({
        thread_id: selectedThread!,
        body: newReply.body,
        author_name: newReply.author_name || "Anonymous Developer",
        user_id: session.session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-replies", selectedThread] });
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      setNewReply({ body: "", author_name: "" });
      toast.success("Reply posted.");
    },
    onError: (err: Error) => toast.error(extractEdgeFunctionError(err)),
  });

  const activeThread = threads.find((t) => t.id === selectedThread);

  return (
    <>
      <Helmet>
        <title>Developer Forum | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Community forum for Kang Open Banking API developers. Ask questions, share solutions, and collaborate with other integrators." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/forum" />
      </Helmet>

      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Developer Forum</h1>
          <p className="text-lg text-muted-foreground">
            Ask questions, share solutions, and collaborate with the Kang Open Banking developer community.
          </p>
        </div>

        {/* Thread Detail View */}
        {selectedThread && activeThread ? (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedThread(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to threads
            </button>

            <div className="border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                      {activeThread.category}
                    </span>
                    {activeThread.is_resolved && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-primary/30 text-primary flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Resolved
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">{activeThread.title}</h2>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activeThread.body}</p>
              <div className="text-xs text-muted-foreground">
                {activeThread.author_name} -- {formatDistanceToNow(new Date(activeThread.created_at), { addSuffix: true })}
              </div>
            </div>

            {/* Replies */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
              </h3>
              {repliesLoading ? (
                <p className="text-sm text-muted-foreground">Loading replies...</p>
              ) : replies.length === 0 ? (
                <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">No replies yet. Be the first to help.</p>
              ) : (
                replies.map((reply) => (
                  <div key={reply.id} className="border border-border rounded-lg p-4 space-y-2">
                    {reply.is_accepted_answer && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-primary/30 text-primary inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Accepted Answer
                      </span>
                    )}
                    <p className="text-sm text-foreground whitespace-pre-wrap">{reply.body}</p>
                    <div className="text-xs text-muted-foreground">
                      {reply.author_name} -- {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply Form */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Post a Reply</h3>
              <Input
                placeholder="Display name (optional)"
                value={newReply.author_name}
                onChange={(e) => setNewReply((p) => ({ ...p, author_name: e.target.value }))}
              />
              <Textarea
                placeholder="Write your reply..."
                rows={4}
                value={newReply.body}
                onChange={(e) => setNewReply((p) => ({ ...p, body: e.target.value }))}
              />
              <Button
                onClick={() => createReply.mutate()}
                disabled={!newReply.body.trim() || createReply.isPending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {createReply.isPending ? "Posting..." : "Post Reply"}
              </Button>
            </div>
          </div>
        ) : (
          /* Thread List View */
          <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCategory === "all" ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setFilterCategory(cat.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCategory === cat.value ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowNewThread(!showNewThread)}
              >
                <Plus className="h-4 w-4" />
                New Thread
              </Button>
            </div>

            {/* New Thread Form */}
            {showNewThread && (
              <div className="border border-border rounded-lg p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <h2 className="text-lg font-semibold text-foreground">Start a New Thread</h2>
                <Input
                  placeholder="Display name (optional)"
                  value={newThread.author_name}
                  onChange={(e) => setNewThread((p) => ({ ...p, author_name: e.target.value }))}
                />
                <Input
                  placeholder="Thread title"
                  value={newThread.title}
                  onChange={(e) => setNewThread((p) => ({ ...p, title: e.target.value }))}
                />
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newThread.category}
                  onChange={(e) => setNewThread((p) => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <Textarea
                  placeholder="Describe your question or topic in detail..."
                  rows={5}
                  value={newThread.body}
                  onChange={(e) => setNewThread((p) => ({ ...p, body: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => createThread.mutate()}
                    disabled={!newThread.title.trim() || !newThread.body.trim() || createThread.isPending}
                  >
                    {createThread.isPending ? "Creating..." : "Create Thread"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewThread(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Thread List */}
            {threadsLoading ? (
              <p className="text-sm text-muted-foreground">Loading threads...</p>
            ) : threads.length === 0 ? (
              <div className="border border-border rounded-lg p-8 text-center space-y-2">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No threads yet. Be the first to start a discussion.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThread(thread.id)}
                    className="w-full text-left border border-border rounded-lg p-4 hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                            {thread.category}
                          </span>
                          {thread.is_resolved && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-primary/30 text-primary flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Resolved
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground truncate">{thread.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{thread.body}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{thread.author_name}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {thread.replies_count}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-2" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <AutoDocNavigation />
      </div>
    </>
  );
}
