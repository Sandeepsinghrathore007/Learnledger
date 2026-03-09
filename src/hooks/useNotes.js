/**
 * useNotes.js — Custom hook for aggregating and managing notes across all subjects.
 *
 * Responsibilities:
 *  - Flattens notes from all subjects/topics into a single unified list
 *  - Enriches each note with subject/topic metadata for display
 *  - Provides search functionality (title + content)
 *  - Provides filtering by subjects, topics, tags, favorites
 *  - Provides sorting options (recent, alphabetical, oldest)
 *  - Handles note creation, updates, and deletion
 *
 * Returns:
 *  - allNotes: Array of all notes with enriched metadata
 *  - filteredNotes: Notes after applying search/filters/sort
 *  - filters: Current filter state
 *  - searchQuery: Current search string
 *  - sortBy: Current sort option
 *  - + handler functions for all operations
 */

import { useMemo, useState } from 'react'

/**
 * Extracts plain text from TipTap HTML content for searching.
 * Removes all HTML tags and returns clean text.
 */
function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Calculates word count from TipTap HTML content.
 */
function getWordCount(html) {
  const text = stripHtml(html)
  return text ? text.split(/\s+/).length : 0
}

/**
 * Formats a date string into a relative time description.
 * Examples: "2 hours ago", "3 days ago", "just now"
 */
function formatRelativeTime(dateString) {
  if (!dateString) return 'Unknown'
  
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

export function useNotes(subjects, onUpdateSubject) {
  // ── FILTER & SEARCH STATE ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    subjects: [],    // Array of subject IDs to filter by
    tags: [],        // Array of tags to filter by
    showFavoritesOnly: false,
  })
  const [sortBy, setSortBy] = useState('recent') // 'recent' | 'alphabetical' | 'oldest'

  // ── AGGREGATE NOTES FROM ALL SUBJECTS ──────────────────────────────────────
  /**
   * Flattens the nested structure: subjects → topics → notes
   * Each note is enriched with parent subject/topic metadata for display.
   */
  const allNotes = useMemo(() => {
    const notes = []
    
    subjects.forEach(subject => {
      subject.topics.forEach(topic => {
        topic.notes.forEach(note => {
          // Enrich note with subject & topic context
          notes.push({
            ...note,
            // Subject metadata
            subjectId: subject.id,
            subjectName: subject.name,
            subjectColor: subject.color,
            subjectIcon: subject.icon,
            // Topic metadata
            topicId: topic.id,
            topicName: topic.name,
            // Computed fields for display
            wordCount: getWordCount(note.content),
            preview: stripHtml(note.content).slice(0, 150) + '...',
            relativeTime: formatRelativeTime(note.updatedAt),
          })
        })
      })
    })
    
    return notes
  }, [subjects])

  // ── SEARCH IMPLEMENTATION ──────────────────────────────────────────────────
  /**
   * Searches notes by title and content.
   * Case-insensitive, matches partial strings.
   */
  const searchedNotes = useMemo(() => {
    if (!searchQuery.trim()) return allNotes
    
    const query = searchQuery.toLowerCase()
    return allNotes.filter(note => {
      const titleMatch = note.title.toLowerCase().includes(query)
      const contentMatch = stripHtml(note.content).toLowerCase().includes(query)
      return titleMatch || contentMatch
    })
  }, [allNotes, searchQuery])

  // ── FILTER IMPLEMENTATION ──────────────────────────────────────────────────
  /**
   * Applies active filters to the searched notes.
   * All filters use AND logic (must match all active filters).
   */
  const filteredNotes = useMemo(() => {
    let result = searchedNotes

    // Filter by subjects (if any subjects are selected)
    if (filters.subjects.length > 0) {
      result = result.filter(note => filters.subjects.includes(note.subjectId))
    }

    // Filter by tags (if any tags are selected)
    if (filters.tags.length > 0) {
      result = result.filter(note =>
        note.tags?.some(tag => filters.tags.includes(tag))
      )
    }

    // Filter favorites only
    if (filters.showFavoritesOnly) {
      result = result.filter(note => note.isFavorite)
    }

    return result
  }, [searchedNotes, filters])

  // ── SORT IMPLEMENTATION ────────────────────────────────────────────────────
  /**
   * Sorts the filtered notes based on the selected sort option.
   * IMPORTANT: Pinned notes always appear first, regardless of sort order.
   */
  const sortedNotes = useMemo(() => {
    const sorted = [...filteredNotes]

    // First, separate pinned and unpinned notes
    const pinned = sorted.filter(note => note.isPinned)
    const unpinned = sorted.filter(note => !note.isPinned)

    // Sort each group independently
    const sortFn = (a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        case 'alphabetical':
          return a.title.localeCompare(b.title)
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt)
        default:
          return 0
      }
    }

    pinned.sort(sortFn)
    unpinned.sort(sortFn)

    // Pinned notes always come first
    return [...pinned, ...unpinned]
  }, [filteredNotes, sortBy])

  // ── FILTER ACTIONS ─────────────────────────────────────────────────────────
  
  /** Toggle a subject filter on/off */
  const toggleSubjectFilter = (subjectId) => {
    setFilters(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subjectId)
        ? prev.subjects.filter(id => id !== subjectId)
        : [...prev.subjects, subjectId],
    }))
  }

  /** Toggle a tag filter on/off */
  const toggleTagFilter = (tag) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }))
  }

  /** Toggle favorites-only filter */
  const toggleFavoritesFilter = () => {
    setFilters(prev => ({ ...prev, showFavoritesOnly: !prev.showFavoritesOnly }))
  }

  /** Clear all filters */
  const clearFilters = () => {
    setFilters({ subjects: [], tags: [], showFavoritesOnly: false })
    setSearchQuery('')
  }

  // ── NOTE CRUD ACTIONS ──────────────────────────────────────────────────────

  /**
   * Toggle favorite status for a note.
   * Finds the note in the subjects array and updates it.
   */
  const toggleFavorite = (noteId) => {
    const noteData = allNotes.find(n => n.id === noteId)
    if (!noteData) return

    const updatedSubject = subjects.find(s => s.id === noteData.subjectId)
    if (!updatedSubject) return

    const updatedTopics = updatedSubject.topics.map(topic => {
      if (topic.id !== noteData.topicId) return topic
      return {
        ...topic,
        notes: topic.notes.map(note =>
          note.id === noteId ? { ...note, isFavorite: !note.isFavorite } : note
        ),
      }
    })

    onUpdateSubject({ ...updatedSubject, topics: updatedTopics })
  }

  /**
   * Toggle pin status for a note.
   * Pinned notes always appear at the top of the list.
   */
  const togglePin = (noteId) => {
    const noteData = allNotes.find(n => n.id === noteId)
    if (!noteData) return

    const updatedSubject = subjects.find(s => s.id === noteData.subjectId)
    if (!updatedSubject) return

    const updatedTopics = updatedSubject.topics.map(topic => {
      if (topic.id !== noteData.topicId) return topic
      return {
        ...topic,
        notes: topic.notes.map(note =>
          note.id === noteId ? { ...note, isPinned: !note.isPinned } : note
        ),
      }
    })

    onUpdateSubject({ ...updatedSubject, topics: updatedTopics })
  }

  /**
   * Add a linked note reference.
   * Creates a one-way link from sourceNoteId to targetNoteId.
   */
  const addLinkedNote = (sourceNoteId, targetNoteId) => {
    const noteData = allNotes.find(n => n.id === sourceNoteId)
    if (!noteData) return

    const updatedSubject = subjects.find(s => s.id === noteData.subjectId)
    if (!updatedSubject) return

    const updatedTopics = updatedSubject.topics.map(topic => {
      if (topic.id !== noteData.topicId) return topic
      return {
        ...topic,
        notes: topic.notes.map(note => {
          if (note.id !== sourceNoteId) return note
          const linkedNotes = note.linkedNotes || []
          // Don't add duplicate links
          if (linkedNotes.includes(targetNoteId)) return note
          return { ...note, linkedNotes: [...linkedNotes, targetNoteId] }
        }),
      }
    })

    onUpdateSubject({ ...updatedSubject, topics: updatedTopics })
  }

  /**
   * Remove a linked note reference.
   */
  const removeLinkedNote = (sourceNoteId, targetNoteId) => {
    const noteData = allNotes.find(n => n.id === sourceNoteId)
    if (!noteData) return

    const updatedSubject = subjects.find(s => s.id === noteData.subjectId)
    if (!updatedSubject) return

    const updatedTopics = updatedSubject.topics.map(topic => {
      if (topic.id !== noteData.topicId) return topic
      return {
        ...topic,
        notes: topic.notes.map(note => {
          if (note.id !== sourceNoteId) return note
          const linkedNotes = note.linkedNotes || []
          return { ...note, linkedNotes: linkedNotes.filter(id => id !== targetNoteId) }
        }),
      }
    })

    onUpdateSubject({ ...updatedSubject, topics: updatedTopics })
  }

  /**
   * Delete a note by ID.
   * Removes it from the parent topic's notes array.
   */
  const deleteNote = (noteId) => {
    const noteData = allNotes.find(n => n.id === noteId)
    if (!noteData) return

    const updatedSubject = subjects.find(s => s.id === noteData.subjectId)
    if (!updatedSubject) return

    const updatedTopics = updatedSubject.topics.map(topic => {
      if (topic.id !== noteData.topicId) return topic
      return {
        ...topic,
        notes: topic.notes.filter(note => note.id !== noteId),
      }
    })

    onUpdateSubject({ ...updatedSubject, topics: updatedTopics })
  }

  // ── EXPORT FUNCTIONS ───────────────────────────────────────────────────────

  /**
   * Export a note as Markdown.
   * Converts TipTap HTML to Markdown format and triggers download.
   */
  const exportAsMarkdown = (noteId) => {
    const note = allNotes.find(n => n.id === noteId)
    if (!note) return

    // Convert HTML to Markdown (simple conversion)
    let markdown = `# ${note.title}\n\n`
    markdown += `**Subject:** ${note.subjectName} - ${note.topicName}\n`
    markdown += `**Tags:** ${note.tags?.join(', ') || 'None'}\n`
    markdown += `**Last Updated:** ${new Date(note.updatedAt).toLocaleDateString()}\n\n`
    markdown += `---\n\n`
    
    // Simple HTML to Markdown conversion
    let content = note.content || ''
    content = content.replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n\n')
    content = content.replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n\n')
    content = content.replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n\n')
    content = content.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
    content = content.replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
    content = content.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
    content = content.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gs, '```\n$1\n```\n')
    content = content.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gs, '> $1\n')
    content = content.replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
    content = content.replace(/<br\s*\/?>/g, '\n')
    content = content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n')
    content = content.replace(/<ul[^>]*>(.*?)<\/ul>/gs, '$1\n')
    content = content.replace(/<ol[^>]*>(.*?)<\/ol>/gs, '$1\n')
    content = content.replace(/<[^>]*>/g, '') // Remove remaining HTML tags

    markdown += content

    // Create and download file
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Export a note as PDF.
   * Creates a printable HTML version and triggers print dialog.
   */
  const exportAsPDF = (noteId) => {
    const note = allNotes.find(n => n.id === noteId)
    if (!note) return

    // Create a print-friendly HTML document
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to export PDF')
      return
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${note.title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
              font-family: 'DM Sans', sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
            }
            
            .header {
              border-bottom: 3px solid ${note.subjectColor};
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            
            h1 {
              font-size: 32px;
              font-weight: 700;
              color: #1a1a1a;
              margin-bottom: 12px;
            }
            
            .meta {
              display: flex;
              gap: 20px;
              flex-wrap: wrap;
              font-size: 14px;
              color: #666;
            }
            
            .meta-item {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            
            .badge {
              display: inline-block;
              background: ${note.subjectColor}20;
              color: ${note.subjectColor};
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
            }
            
            .content {
              margin-top: 30px;
            }
            
            .content h2 { 
              font-size: 24px; 
              margin: 24px 0 12px;
              color: #1a1a1a;
            }
            
            .content h3 { 
              font-size: 20px; 
              margin: 20px 0 10px;
              color: #1a1a1a;
            }
            
            .content p { 
              margin: 12px 0;
              line-height: 1.7;
            }
            
            .content ul, .content ol {
              margin: 12px 0;
              padding-left: 24px;
            }
            
            .content li {
              margin: 6px 0;
            }
            
            .content pre {
              background: #f5f5f5;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              padding: 16px;
              overflow-x: auto;
              margin: 16px 0;
              font-family: 'Courier New', monospace;
              font-size: 13px;
              line-height: 1.5;
            }
            
            .content code {
              background: #f5f5f5;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
              font-size: 13px;
            }
            
            .content pre code {
              background: none;
              padding: 0;
            }
            
            .content blockquote {
              border-left: 4px solid ${note.subjectColor};
              padding-left: 16px;
              margin: 16px 0;
              color: #555;
              font-style: italic;
            }
            
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 12px;
              color: #999;
              text-align: center;
            }
            
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${note.title}</h1>
            <div class="meta">
              <div class="meta-item">
                <span class="badge">${note.subjectIcon} ${note.subjectName}</span>
              </div>
              <div class="meta-item">
                <strong>Topic:</strong> ${note.topicName}
              </div>
              <div class="meta-item">
                <strong>Updated:</strong> ${new Date(note.updatedAt).toLocaleDateString()}
              </div>
              ${note.tags && note.tags.length > 0 ? `
                <div class="meta-item">
                  <strong>Tags:</strong> ${note.tags.join(', ')}
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="content">
            ${note.content || '<p>No content</p>'}
          </div>
          
          <div class="footer">
            Generated from Learnledger on ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    
    // Wait for content to load, then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  // ── COLLECT ALL UNIQUE TAGS ────────────────────────────────────────────────
  /**
   * Extracts all unique tags from all notes for the tag filter UI.
   */
  const allTags = useMemo(() => {
    const tagSet = new Set()
    allNotes.forEach(note => {
      note.tags?.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [allNotes])

  // ── RETURN API ─────────────────────────────────────────────────────────────
  return {
    // All notes (unfiltered)
    allNotes,
    
    // Filtered & sorted notes (this is what UI displays)
    filteredNotes: sortedNotes,
    
    // Search & filter state
    searchQuery,
    setSearchQuery,
    filters,
    sortBy,
    setSortBy,
    
    // Filter actions
    toggleSubjectFilter,
    toggleTagFilter,
    toggleFavoritesFilter,
    clearFilters,
    
    // Note actions
    toggleFavorite,
    togglePin,
    deleteNote,
    
    // Linked notes
    addLinkedNote,
    removeLinkedNote,
    
    // Export
    exportAsMarkdown,
    exportAsPDF,
    
    // Metadata
    allTags,
  }
}
