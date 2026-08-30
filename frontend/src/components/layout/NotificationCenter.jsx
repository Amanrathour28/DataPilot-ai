import React, { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, MessageSquare, AtSign, UserPlus, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { notificationsApi } from '../../services/api'
import { Link } from 'react-router-dom'

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef(null)

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const data = await notificationsApi.list(30)
      setNotifications(data || [])
    } catch (err) {
      console.warn('Failed to fetch notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000) // 30s background sync
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      )
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }

  const handleNotificationClick = async (notif) => {
    if (!notif.read_at) {
      try {
        await notificationsApi.markRead(notif.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
        )
      } catch (err) {
        console.warn('Failed to mark notification read:', err)
      }
    }
    setIsOpen(false)
  }

  const getIcon = (type) => {
    switch (type) {
      case 'MENTION':
        return <AtSign size={13} className="text-[#c8ff00]" />
      case 'ASSIGNMENT':
      case 'INVITATION':
      case 'INVITATION_ACCEPTED':
        return <UserPlus size={13} className="text-[#c8ff00]" />
      case 'COMMENT':
        return <MessageSquare size={13} className="text-[#f2f2ef]/70" />
      case 'FINDING_VERIFIED':
      case 'INVESTIGATION_COMPLETED':
        return <CheckCircle2 size={13} className="text-[#c8ff00]" />
      case 'INVESTIGATION_FAILED':
        return <AlertCircle size={13} className="text-red-400" />
      default:
        return <Bell size={13} className="text-[#f2f2ef]/70" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) loadNotifications()
        }}
        className="relative flex items-center justify-center w-8 h-8 rounded border border-white/[0.08] bg-[#0c0c0c] hover:bg-white/[0.04] text-[#f2f2ef]/70 hover:text-[#f2f2ef] transition-colors"
        title="Notifications"
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#c8ff00] text-black font-mono text-[9px] font-bold tracking-tighter">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-none border border-white/[0.12] bg-[#0c0c0c] shadow-2xl z-50 overflow-hidden font-sans">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-black/40">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#f2f2ef]/60">
                NOTIFICATIONS
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#c8ff00]/10 border border-[#c8ff00]/20 text-[#c8ff00] font-mono text-[9px]">
                  {unreadCount} NEW
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 font-mono text-[10px] text-[#f2f2ef]/50 hover:text-[#c8ff00] transition-colors"
              >
                <CheckCheck size={12} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.04]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-[#f2f2ef]/40 font-mono text-xs">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.read_at
                const targetLink =
                  notif.resource_type === 'investigation' && notif.resource_id
                    ? `/investigations/${notif.resource_id}`
                    : null

                const Content = (
                  <div
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 sm:p-4 flex gap-3 transition-colors cursor-pointer ${
                      isUnread ? 'bg-white/[0.03] hover:bg-white/[0.06]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded border border-white/[0.08] bg-black/60">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans text-xs font-semibold text-[#f2f2ef] truncate">
                          {notif.title}
                        </span>
                        <span className="font-mono text-[9px] text-[#f2f2ef]/40 shrink-0">
                          {new Date(notif.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="font-sans text-xs text-[#f2f2ef]/70 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00] shrink-0 mt-2" />
                    )}
                  </div>
                )

                return targetLink ? (
                  <Link key={notif.id} to={targetLink} className="block text-inherit">
                    {Content}
                  </Link>
                ) : (
                  <div key={notif.id}>{Content}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
