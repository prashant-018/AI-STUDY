"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X, Check, Trash2, Filter, Settings, Archive, Mail, AlertTriangle, Info, CheckCircle, Zap, BookOpen, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  priority: "urgent" | "high" | "medium" | "low";
  createdAt: string;
  metadata?: {
    actionUrl?: string;
    imageUrl?: string;
    userId?: string;
    relatedEntity?: string;
    progress?: number;
  };
  relatedId?: string;
  relatedType?: string;
}

interface NotificationsProps {
  token?: string;
  onNotificationClick?: (notification: Notification) => void;
}

export default function Notifications({ token, onNotificationClick }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | string>("all");
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const [notificationsRes, unreadRes] = await Promise.all([
        fetch(`${API_URL}/api/notifications?limit=100&sort=-createdAt`, {
          credentials: "include",
          headers,
        }),
        fetch(`${API_URL}/api/notifications/unread-count`, {
          credentials: "include",
          headers,
        }),
      ]);

      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications(data.notifications || []);
      }

      if (unreadRes.ok) {
        const data = await unreadRes.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        credentials: "include",
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) =>
          prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setIsMarkingAll(true);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
        headers,
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/notifications/${notificationId}`, {
        method: "DELETE",
        credentials: "include",
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const archiveNotification = async (notificationId: string) => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/notifications/${notificationId}/archive`, {
        method: "PATCH",
        credentials: "include",
        headers,
      });

      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        // Update unread count if needed
        const notification = notifications.find(n => n._id === notificationId);
        if (notification && !notification.isRead) {
          setUnreadCount(prev => prev - 1);
        }
      }
    } catch (error) {
      console.error("Error archiving notification:", error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500/10 text-red-700 border-red-200";
      case "high":
        return "bg-orange-500/10 text-orange-700 border-orange-200";
      case "medium":
        return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "low":
        return "bg-slate-500/10 text-slate-700 border-slate-200";
      default:
        return "bg-slate-500/10 text-slate-700 border-slate-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "documents":
        return <BookOpen className="h-4 w-4" />;
      case "flashcards":
        return <Zap className="h-4 w-4" />;
      case "quiz":
        return <Target className="h-4 w-4" />;
      case "progress":
        return <Sparkles className="h-4 w-4" />;
      case "profile":
        return <Info className="h-4 w-4" />;
      case "security":
        return <AlertTriangle className="h-4 w-4" />;
      case "ai":
        return <Sparkles className="h-4 w-4" />;
      case "system":
        return <Settings className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "documents":
        return "text-blue-600 bg-blue-50";
      case "flashcards":
        return "text-purple-600 bg-purple-50";
      case "quiz":
        return "text-emerald-600 bg-emerald-50";
      case "progress":
        return "text-amber-600 bg-amber-50";
      case "profile":
        return "text-indigo-600 bg-indigo-50";
      case "security":
        return "text-red-600 bg-red-50";
      case "ai":
        return "text-pink-600 bg-pink-50";
      case "system":
        return "text-slate-600 bg-slate-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getNotificationIcon = (priority: string, category: string) => {
    if (priority === "urgent") {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    if (priority === "high") {
      return <Info className="h-5 w-5 text-orange-500" />;
    }
    return getCategoryIcon(category);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.isRead;
    return n.category === filter;
  });

  const categories = [
    { id: "all", label: "All", count: notifications.length },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "documents", label: "Documents", count: notifications.filter(n => n.category === "documents").length },
    { id: "flashcards", label: "Flashcards", count: notifications.filter(n => n.category === "flashcards").length },
    { id: "quiz", label: "Quizzes", count: notifications.filter(n => n.category === "quiz").length },
    { id: "progress", label: "Progress", count: notifications.filter(n => n.category === "progress").length },
    { id: "ai", label: "AI", count: notifications.filter(n => n.category === "ai").length },
  ];

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    if (notification.metadata?.actionUrl) {
      window.location.href = notification.metadata.actionUrl;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl transition-all duration-200 hover:bg-slate-100 hover:scale-105"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs font-bold border-2 border-white shadow-lg animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2 text-xl">
                <Bell className="h-5 w-5" />
                Notifications
              </SheetTitle>
              <SheetDescription className="mt-1">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                  : "You're all caught up!"
                }
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={isMarkingAll}
                  className="text-xs h-8"
                >
                  {isMarkingAll ? (
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Mark all read
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Mail className="h-4 w-4 mr-2" />
                    Notification settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={markAllAsRead}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark all as read
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SheetHeader>

        <div className="p-4 border-b border-slate-200">
          <Tabs defaultValue="all" className="w-full" onValueChange={(v) => setFilter(v)}>
            <TabsList className="grid w-full grid-cols-4 h-10">
              <TabsTrigger value="all" className="text-xs">
                All
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-xs">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                Unread
                {unreadCount > 0 && (
                  <Badge className="ml-1 h-4 min-w-4 px-1 text-xs bg-blue-500">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">
                Docs
              </TabsTrigger>
              <TabsTrigger value="progress" className="text-xs">
                Progress
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-600">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">No notifications</p>
              <p className="text-xs text-slate-600 text-center max-w-xs">
                {filter === "unread"
                  ? "You've read all your notifications"
                  : "Notifications will appear here"
                }
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification._id}
                  className={cn(
                    "group relative p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-lg",
                    notification.isRead
                      ? "bg-white border-slate-200 hover:border-slate-300"
                      : "bg-blue-50 border-blue-200 hover:border-blue-300"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}

                  <div className="flex items-start gap-3 ml-2">
                    {/* Icon */}
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                      getCategoryColor(notification.category)
                    )}>
                      {getNotificationIcon(notification.priority, notification.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-medium border",
                                getPriorityColor(notification.priority)
                              )}
                            >
                              {notification.priority}
                            </Badge>
                            <span className="text-xs text-slate-500 capitalize">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <h4 className={cn(
                            "font-semibold text-sm mb-1 line-clamp-1",
                            notification.isRead ? "text-slate-900" : "text-slate-900"
                          )}>
                            {notification.title}
                          </h4>
                          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification._id);
                              }}
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification._id);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress bar for progress notifications */}
                      {notification.metadata?.progress !== undefined && (
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${notification.metadata.progress}%` }}
                          ></div>
                        </div>
                      )}

                      {/* Action buttons */}
                      {notification.metadata?.actionUrl && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = notification.metadata!.actionUrl!;
                            }}
                          >
                            View Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={markAllAsRead}
                disabled={isMarkingAll || unreadCount === 0}
              >
                {isMarkingAll ? "Marking..." : "Mark all as read"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

