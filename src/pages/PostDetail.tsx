import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { generatePostId, slugify } from '../utils/hash';
import { Comments } from '../components/Comments';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, User, AlertCircle, Pencil, Trash2 } from 'lucide-react';

interface BlogPost {
  id: number;
  title: string;
  blurb: string;
  dateTime: string;
  content?: string;
  authorUuid?: string | null;
}

export const PostDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, isAdmin, isWriter } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const [post, setPost] = useState<BlogPost | null>(() => {
    const locState = location.state as { post?: BlogPost } | null;
    if (locState && locState.post) {
      return locState.post;
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    const locState = location.state as { post?: BlogPost } | null;
    if (locState && locState.post) {
      return false;
    }
    return true;
  });

  const [error, setError] = useState<string | null>(null);

  const commentsApiUrl = import.meta.env.VITE_COMMENTS_API_URL || 'https://srv915664.hstgr.cloud:8081';

  useEffect(() => {
    if (post) return; // already initialized from location state

    const fetchAndFindPost = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(commentsApiUrl + '/posts');
        if (!res.ok) {
          throw new Error('Failed to retrieve blogs from database.');
        }
        const data = (await res.json()) as unknown[];
        if (Array.isArray(data)) {
          const mappedPosts = data.map((p: unknown) => {
            const item = p as Record<string, unknown>;
            const title = (item.pTitle || item.title || '') as string;
            const id = (item.pId || item.id || generatePostId(title)) as number;
            const blurb = (item.pBlurb || item.blurb || '') as string;
            const content = (item.pContent || item.content || '') as string;
            const dateTime = (item.pDateTime || item.dateTime || '') as string;
            const authorUuid = (item.pAuthorUuid ?? item.authorUuid ?? null) as string | null;
            return { id, title, blurb, content, dateTime, authorUuid };
          });

          const matched = mappedPosts.find((p: BlogPost) => slugify(p.title) === slug);
          if (matched) {
            setPost(matched);
          } else {
            throw new Error('Blog post not found.');
          }
        } else {
          throw new Error('Invalid format returned by the blog database.');
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Error retrieving blog post details:', err);
        setError(errorMsg || 'Error loading blog post.');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      void fetchAndFindPost();
    }
  }, [slug, post, commentsApiUrl]);

  // Admins may manage any post; writers only the ones they authored. The
  // backend enforces the same rule -- this just hides controls that would fail.
  const canManage =
    !!post && !!token && (isAdmin || (isWriter && !!user && post.authorUuid === user.userId));

  const handleDelete = async () => {
    if (!post || !token) return;
    if (!window.confirm('Delete "' + post.title + '"? This also removes its comments and cannot be undone.')) {
      return;
    }
    try {
      setDeleting(true);
      const res = await fetch(commentsApiUrl + '/posts/' + post.id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || res.statusText);
      }
      void navigate('/');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Error deleting blog post:', err);
      setError('Failed to delete post: ' + errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  const renderContent = (text: string) => {
    const normalized = text.replace(/\r\n/g, '\n');
    const tokens = normalized.split(/([\u0060][^\u0060]*[\u0060])/g).filter((t) => t !== '');

    const elements: React.ReactNode[] = [];
    let currentLine: React.ReactNode[] = [];
    let key = 0;

    const flushLine = () => {
      const hasContent = currentLine.some((n) => (typeof n === 'string' ? n.trim() : true));
      if (hasContent) {
        elements.push(
          <p key={key++} className="mb-6 leading-relaxed text-[var(--text)] text-base md:text-lg whitespace-pre-wrap">
            {currentLine}
          </p>
        );
      }
      currentLine = [];
    };

    tokens.forEach((token) => {
      const tick = String.fromCharCode(96);
      const isCode = token.startsWith(tick) && token.endsWith(tick) && token.length >= 2;

      if (isCode) {
        const codeText = token.slice(1, -1);
        if (codeText.includes('\n')) {
          flushLine();
          elements.push(
            <pre key={key++} className="mb-6 p-4 rounded-lg bg-[var(--code-bg)] border border-[var(--border)] overflow-x-auto text-sm">
              <code className="font-mono text-[var(--text-h)]">
                {codeText.replace(/^\n/, '').replace(/\n$/, '')}
              </code>
            </pre>
          );
        } else {
          currentLine.push(
            <code key={key++} className="bg-[var(--code-bg)] px-1.5 py-0.5 rounded text-sm text-[var(--accent)] font-mono border border-[var(--border)] font-medium">
              {codeText}
            </code>
          );
        }
      } else {
        token.split('\n').forEach((line, idx) => {
          if (idx > 0) flushLine();
          if (line) currentLine.push(line);
        });
      }
    });
    flushLine();

    return elements;
  };

  return (
    <div className="w-[92%] max-w-[1600px] mx-auto py-12 px-6">
      <div className="mb-8 text-left">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)] hover:text-[var(--accent)] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to publications</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-[var(--text)] font-medium">Loading article details...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-center max-w-lg mx-auto flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8" />
          <h3 className="font-semibold text-lg">Unable to Open Article</h3>
          <p className="text-sm text-[var(--text)]">{error}</p>
        </div>
      ) : post ? (
        <article className="text-left max-w-4xl mx-auto">
          <header className="mb-10 pb-8 border-b border-[var(--border)]">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--text-h)] tracking-tight mb-6 leading-tight">
              {post.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-[var(--text)] font-medium">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{post.dateTime}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>By Sammy Thorne</span>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 ml-auto">
                  <Link
                    to={'/edit/' + post.id}
                    state={{ post }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="prose max-w-none mb-12">
            {post.content ? (
              renderContent(post.content)
            ) : (
              <p className="italic text-[var(--text)]">No content available for this post.</p>
            )}
          </div>

          <Comments postId={post.id} />
        </article>
      ) : null}
    </div>
  );
};
