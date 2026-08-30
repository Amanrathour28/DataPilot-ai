import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Sparkles,
  UserCheck,
  Reply,
  AtSign,
  Clock,
  ArrowRight,
  Bot,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { collaborationApi } from '../../services/api'
import useAuthStore from '../../stores/authStore'
import { useToast } from '../ui/Toast'

export default function DiscussionTab({ investigationId, onFollowUpTriggered }) {
  const { user } = useAuthStore()
  const toast = useToast()

  const [comments, setComments] = useState([])
  const [collaborators, setCollaborators] = useState([])
  const [newCommentText, setNewCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTriggering, setIsTriggering] = useState(null)

  const loadComments = async () => {
    if (!investigationId) return
    try {
      const [commentsData, membersData] = await Promise.all([
        collaborationApi.getComments(investigationId),
        collaborationApi.getMembers(investigationId).catch(() => []),
      ])
      setComments(commentsData || [])
      setCollaborators(membersData || [])
    } catch (err) {
      console.warn('Failed to load discussion comments:', err)
    }
  }

  useEffect(() => {
    loadComments()
    const interval = setInterval(loadComments, 10000) // 10s live poll
    return () => clearInterval(interval)
  }, [investigationId])

  const handlePostComment = async (e) => {
    e.preventDefault()
    if (!newCommentText.trim()) return
    try {
      setIsSubmitting(true)
      const newComment = await collaborationApi.postComment(investigationId, {
        content: newCommentText.trim(),
        parent_id: replyingTo?.id || null,
      })
      setNewCommentText('')
      setReplyingTo(null)
      loadComments()
      toast?.show('Comment posted to investigation', 'success')
    } catch (err) {
      toast?.show('Failed to post comment', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTriggerFollowUp = async (commentId) => {
    try {
      setIsTriggering(commentId)
      const res = await collaborationApi.triggerFollowUp(investigationId, commentId)
      toast?.show(res.message || 'AI follow-up task queued', 'success')
      loadComments()
      if (onFollowUpTriggered) onFollowUpTriggered()
    } catch (err) {
      toast?.show('Failed to dispatch follow-up task', 'error')
    } finally {
      setIsTriggering(null)
    }
  }

  const insertMention = (name) => {
    setNewCommentText((prev) => `${prev}@${name} `)
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Collaboration Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c8ff00]">
            HUMAN + AI COLLABORATION
          </span>
          <h3 className="font-serif text-lg text-[#f2f2ef] tracking-tight mt-0.5">
            Investigation Discussion & Follow-ups
          </h3>
        </div>

        {collaborators.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="font-mono text-[10px] text-[#f2f2ef]/40 mr-1 shrink-0">
              Active Teammates:
            </span>
            {collaborators.map((c) => (
              <button
                key={c.id}
                onClick={() => insertMention(c.name)}
                className="flex items-center gap-1 px-2 py-0.5 border border-white/[0.08] bg-[#0c0c0c] hover:border-[#c8ff00]/40 text-[#f2f2ef]/80 font-mono text-[10px] transition-colors cursor-pointer shrink-0"
                title={`Click to @mention ${c.name}`}
              >
                <AtSign size={10} className="text-[#c8ff00]" />
                <span>{c.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Discussion Stream */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="border border-white/[0.08] bg-[#0c0c0c] p-10 text-center space-y-2">
            <MessageSquare size={20} className="text-[#f2f2ef]/30 mx-auto" />
            <h4 className="font-serif text-sm text-[#f2f2ef]">No Discussion Yet</h4>
            <p className="font-sans text-xs text-[#f2f2ef]/50 max-w-md mx-auto">
              Collaborate with colleagues on this investigation. You can challenge findings, suggest
              additional angles, or @mention teammates.
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="border border-white/[0.08] bg-[#0c0c0c] p-4 sm:p-5 space-y-3"
            >
              {/* Comment Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 bg-white/[0.08] border border-white/[0.12] text-[#f2f2ef] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {comment.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-[#f2f2ef]">
                      {comment.author_name}
                    </span>
                    <span className="font-mono text-[10px] text-[#f2f2ef]/40 ml-2">
                      {new Date(comment.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReplyingTo(comment)}
                    className="flex items-center gap-1 font-mono text-[10px] text-[#f2f2ef]/40 hover:text-[#c8ff00] transition-colors cursor-pointer"
                  >
                    <Reply size={11} />
                    <span>Reply</span>
                  </button>
                </div>
              </div>

              {/* Comment Body */}
              <div className="font-sans text-xs text-[#f2f2ef]/90 leading-relaxed pl-8">
                {comment.content}
              </div>

              {/* Autonomous AI Follow-up Trigger Strip */}
              <div className="mt-3 pl-8">
                <div className="border border-white/[0.06] bg-black/40 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-[#f2f2ef]/60">
                    <Sparkles size={13} className="text-[#c8ff00] shrink-0" />
                    <span>Want the AI Swarm to investigate this comment as a follow-up task?</span>
                  </div>
                  <button
                    onClick={() => handleTriggerFollowUp(comment.id)}
                    disabled={isTriggering === comment.id || comment.is_ai_triggered}
                    className="btn-dn-secondary py-1 px-2.5 font-mono text-[10px] flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <span>
                      {comment.is_ai_triggered
                        ? '✓ Task Queued'
                        : isTriggering === comment.id
                        ? 'Queueing...'
                        : 'Investigate This Angle →'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Threaded Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="pl-8 pt-3 space-y-3 border-l border-white/[0.06] ml-3">
                  {comment.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="border border-white/[0.06] bg-white/[0.01] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#f2f2ef]">
                            {reply.author_name}
                          </span>
                          <span className="font-mono text-[9px] text-[#f2f2ef]/40">
                            {new Date(reply.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <p className="font-sans text-xs text-[#f2f2ef]/80 leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Comment Input Box */}
      <Card className="border-white/[0.12] bg-[#090909] p-4 sm:p-5 space-y-3">
        {replyingTo && (
          <div className="flex items-center justify-between bg-white/[0.03] px-3 py-1.5 border-l-2 border-[#c8ff00] text-xs">
            <span className="font-mono text-[10px] text-[#f2f2ef]/60 truncate">
              Replying to <span className="text-[#f2f2ef] font-semibold">{replyingTo.author_name}</span>:{' '}
              "{replyingTo.content.slice(0, 40)}..."
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-[#f2f2ef]/40 hover:text-white font-mono text-xs ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handlePostComment} className="space-y-3">
          <textarea
            required
            rows={3}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add an observation, request a regional drill-down, or challenge a hypothesis (use @ to mention teammates)..."
            className="w-full bg-black border border-white/[0.12] p-3 text-xs font-sans text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-[#f2f2ef]/40">
              <Sparkles size={12} className="text-[#c8ff00]" />
              <span>Comments can be converted into AI follow-up hypotheses.</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !newCommentText.trim()}
              className="flex items-center gap-1.5 font-mono text-xs cursor-pointer shrink-0"
            >
              <Send size={12} />
              <span>{isSubmitting ? 'Posting...' : 'Post Comment →'}</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
