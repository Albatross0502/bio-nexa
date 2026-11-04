import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SEED_MENTORS } from '../../data/seedData';
import { Mentor, DiscussionTopic } from '../../types';
import {
  MessageSquare,
  Users,
  ThumbsUp,
  Send,
  Calendar,
  CheckCircle2,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

export const CommunityPage: React.FC = () => {
  const { discussions, addDiscussion, addDiscussionReply, upvoteDiscussion, currentUser, addToast } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState<DiscussionTopic['category']>('Wet Lab Protocols');
  const [newTopicContent, setNewTopicContent] = useState('');
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);

  // Reply inputs
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});

  // Mentor Booking modal
  const [bookingMentor, setBookingMentor] = useState<Mentor | null>(null);
  const [mentorshipGoal, setMentorshipGoal] = useState('');

  const filteredDiscussions = discussions.filter(
    (d) => selectedCategory === 'all' || d.category === selectedCategory
  );

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle || !newTopicContent) return;

    addDiscussion({
      title: newTopicTitle,
      authorName: currentUser.name,
      authorRole: currentUser.title || 'BIO-NEXA Member',
      category: newTopicCategory,
      content: newTopicContent
    });

    setNewTopicTitle('');
    setNewTopicContent('');
    setShowNewTopicModal(false);
  };

  const handlePostReply = (topicId: string) => {
    const text = replyTextMap[topicId];
    if (!text || !text.trim()) return;

    addDiscussionReply(topicId, text.trim());
    setReplyTextMap((prev) => ({ ...prev, [topicId]: '' }));
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingMentor) return;
    addToast(`Mentorship request submitted to ${bookingMentor.name}! You will receive an invitation link via email.`, 'success');
    setBookingMentor(null);
    setMentorshipGoal('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Biotechnology Community &amp; Scientific Mentorship
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Troubleshoot wet lab protocols with peer researchers, discuss CSIR/GATE strategies, and book 1:1 sessions with industry scientists.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Discussion Boards (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(
                ['all', 'Wet Lab Protocols', 'Career Decisions', 'Exam Strategy', 'Bioinformatics Code'] as const
              ).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#0B2A5B] text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'All Threads' : cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowNewTopicModal(true)}
              className="px-4 py-2 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Start Discussion</span>
            </button>
          </div>

          {/* Topics List */}
          <div className="space-y-4">
            {filteredDiscussions.map((topic) => (
              <div
                key={topic.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider block">
                      {topic.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug mt-0.5">
                      {topic.title}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      Posted by <strong className="text-slate-800 dark:text-slate-200">{topic.authorName}</strong> ({topic.authorRole}) · {topic.createdAt}
                    </div>
                  </div>

                  <button
                    onClick={() => upvoteDiscussion(topic.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs font-mono font-bold shrink-0"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
                    <span>{topic.upvotes}</span>
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {topic.content}
                </p>

                {/* Replies Accordion */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Replies ({topic.replies.length})
                  </div>

                  <div className="space-y-2">
                    {topic.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {reply.authorName} · <span className="font-normal text-slate-500">{reply.authorRole}</span>
                          </span>
                          <span className="text-[10px] font-mono">{reply.createdAt}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Add Reply Input */}
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={replyTextMap[topic.id] || ''}
                      onChange={(e) =>
                        setReplyTextMap((prev) => ({ ...prev, [topic.id]: e.target.value }))
                      }
                      placeholder="Write a peer response or lab solution..."
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => handlePostReply(topic.id)}
                      className="px-3.5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Verified Mentors (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-600">
              <Users className="w-4 h-4" />
              <span>Verified Scientific Mentors</span>
            </div>
            <p className="text-xs text-slate-500">
              Book a 1:1 advisory slot with scientists from Biocon, EMBL-EBI, and IIT Delhi.
            </p>

            <div className="space-y-4 pt-2">
              {SEED_MENTORS.map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                >
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {m.name}
                  </div>
                  <div className="text-slate-500 font-medium">
                    {m.designation} · {m.organization}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {m.bio}
                  </p>
                  <div className="flex flex-wrap gap-1 text-[10px] text-teal-700 dark:text-teal-300 pt-1">
                    {m.specialty.map((s) => (
                      <span key={s} className="bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-500">{m.availableSlots}</span>
                    <button
                      onClick={() => setBookingMentor(m)}
                      className="font-bold text-[#0B2A5B] dark:text-sky-300 hover:underline"
                    >
                      Book 1:1 Slot &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Topic Modal */}
      {showNewTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Start a New Discussion Thread
              </h3>
              <button onClick={() => setShowNewTopicModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Topic Title
                </label>
                <input
                  type="text"
                  required
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="e.g. Protocol troubleshooting for Western blot secondary antibody cross-reactivity..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="Wet Lab Protocols">Wet Lab Protocols</option>
                  <option value="Exam Strategy">Exam Strategy</option>
                  <option value="Career Decisions">Career Decisions</option>
                  <option value="Bioinformatics Code">Bioinformatics Code</option>
                  <option value="Scholarship Tips">Scholarship Tips</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Explanation / Experimental Setup
                </label>
                <textarea
                  rows={4}
                  required
                  value={newTopicContent}
                  onChange={(e) => setNewTopicContent(e.target.value)}
                  placeholder="Describe your cell line, buffers, conditions, and observed outcomes..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg"
                >
                  Publish Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Mentor Modal */}
      {bookingMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Request 1:1 Mentorship Session
                </h3>
                <p className="text-slate-500 mt-0.5">With {bookingMentor.name}</p>
              </div>
              <button onClick={() => setBookingMentor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  What specific advice do you need?
                </label>
                <textarea
                  rows={3}
                  required
                  value={mentorshipGoal}
                  onChange={(e) => setMentorshipGoal(e.target.value)}
                  placeholder="e.g. Reviewing my Biocon interview preparation or advice on postdoc fellowship applications..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                <div>Preferred Slot: <strong className="text-slate-900 dark:text-slate-100">{bookingMentor.availableSlots}</strong></div>
                <div className="text-[11px] text-slate-400 mt-0.5">Session conducted via Google Meet / Zoom (30 mins free).</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBookingMentor(null)}
                  className="px-3 py-1.5 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold rounded-lg"
                >
                  Confirm Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
