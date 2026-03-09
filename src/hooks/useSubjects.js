import { useCallback, useEffect, useMemo, useState } from 'react'
import { SEED_SUBJECTS } from '@/data/seedData'
import { uid } from '@/utils/id'
import { ACTIVITY_TYPES, logActivity } from '@/services/firebase/analyticsService'
import {
  createNote,
  deleteNote,
  subscribeToNotes,
  updateNote as updateNoteDoc,
} from '@/services/firebase/notesService'
import {
  createSubject,
  deleteSubject as deleteSubjectDoc,
  subscribeToSubjects,
  updateSubject as updateSubjectDoc,
} from '@/services/firebase/subjectsService'
import {
  createTopic,
  deleteTopic,
  subscribeToTopics,
  updateTopic as updateTopicDoc,
} from '@/services/firebase/topicsService'

const DEFAULT_FORM = {
  name: '',
  description: '',
  icon: '∑',
  color: '#8b5cf6',
}

function cloneGuestSubjects() {
  return JSON.parse(JSON.stringify(SEED_SUBJECTS))
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : []
}

function sortByMostRecent(items, field = 'updatedAt') {
  return [...items].sort((a, b) => (b[field] || '').localeCompare(a[field] || ''))
}

function normalizeNote(note) {
  const now = new Date().toISOString()

  return {
    id: note.id || uid(),
    title: note.title || 'Untitled Note',
    content: note.content || '<p></p>',
    blocks: toSafeArray(note.blocks),
    tags: toSafeArray(note.tags),
    isFavorite: Boolean(note.isFavorite),
    isPinned: Boolean(note.isPinned),
    linkedNotes: toSafeArray(note.linkedNotes),
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || now,
    lastOpenedAt: note.lastOpenedAt || note.updatedAt || now,
  }
}

function notesAreDifferent(previousNote, nextNote) {
  const previous = normalizeNote(previousNote)
  const next = normalizeNote(nextNote)

  return (
    previous.title !== next.title ||
    previous.content !== next.content ||
    previous.isFavorite !== next.isFavorite ||
    previous.isPinned !== next.isPinned ||
    previous.updatedAt !== next.updatedAt ||
    previous.lastOpenedAt !== next.lastOpenedAt ||
    JSON.stringify(previous.blocks) !== JSON.stringify(next.blocks) ||
    JSON.stringify(previous.tags) !== JSON.stringify(next.tags) ||
    JSON.stringify(previous.linkedNotes) !== JSON.stringify(next.linkedNotes)
  )
}

function topicIsDifferent(previousTopic, nextTopic) {
  const previousNotesLength = toSafeArray(previousTopic.notes).length
  const nextNotesLength = toSafeArray(nextTopic.notes).length

  return (
    String(previousTopic.name || '').trim() !== String(nextTopic.name || '').trim() ||
    (previousTopic.questionsCount || 0) !== (nextTopic.questionsCount || 0) ||
    previousNotesLength !== nextNotesLength
  )
}

function buildSubjects(subjectDocs, topicDocs, noteDocs) {
  const notesByTopic = new Map()

  noteDocs.forEach((note) => {
    const normalized = normalizeNote(note)
    const existing = notesByTopic.get(note.topicId) || []
    existing.push(normalized)
    notesByTopic.set(note.topicId, existing)
  })

  const topicsBySubject = new Map()

  topicDocs.forEach((topic) => {
    const notes = sortByMostRecent(notesByTopic.get(topic.id) || [])
    const normalizedTopic = {
      id: topic.id,
      subjectId: topic.subjectId,
      name: topic.name || 'Untitled Topic',
      questionsCount: topic.questionsCount || 0,
      notes,
      createdAt: topic.createdAt || null,
      updatedAt: topic.updatedAt || null,
    }

    const existing = topicsBySubject.get(topic.subjectId) || []
    existing.push(normalizedTopic)
    topicsBySubject.set(topic.subjectId, existing)
  })

  return sortByMostRecent(
    subjectDocs.map((subject) => ({
      id: subject.id,
      name: subject.name || 'Untitled Subject',
      description: subject.description || '',
      icon: subject.icon || '📘',
      color: subject.color || '#8b5cf6',
      aiScore: subject.aiScore ?? null,
      testsAttempted: subject.testsAttempted || 0,
      pdfs: toSafeArray(subject.pdfs),
      topics: (topicsBySubject.get(subject.id) || []).sort((a, b) =>
        (a.createdAt || '').localeCompare(b.createdAt || '')
      ),
      createdAt: subject.createdAt || null,
      updatedAt: subject.updatedAt || null,
    }))
  )
}

async function safeLogActivity(userId, payload) {
  try {
    await logActivity(userId, payload)
  } catch (error) {
    console.warn('Failed to log activity:', error)
  }
}

export function useSubjects(user) {
  const isAuthenticated = Boolean(user?.uid)

  const [guestSubjects, setGuestSubjects] = useState(() => cloneGuestSubjects())
  const [subjectDocs, setSubjectDocs] = useState([])
  const [topicDocs, setTopicDocs] = useState([])
  const [noteDocs, setNoteDocs] = useState([])

  const [selected, setSelected] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const firestoreSubjects = useMemo(
    () => buildSubjects(subjectDocs, topicDocs, noteDocs),
    [subjectDocs, topicDocs, noteDocs]
  )

  const subjects = isAuthenticated ? firestoreSubjects : guestSubjects

  useEffect(() => {
    if (!isAuthenticated) {
      setGuestSubjects(cloneGuestSubjects())
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!selected) return
    if (!subjects.some((subject) => subject.id === selected.id)) {
      setSelected(null)
    }
  }, [selected, subjects])

  useEffect(() => {
    if (!isAuthenticated) {
      setSubjectDocs([])
      setTopicDocs([])
      setNoteDocs([])
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')

    const handleSubscriptionError = (subscriptionError) => {
      console.error('Failed to sync Firestore data:', subscriptionError)
      if (subscriptionError?.code === 'permission-denied') {
        setError('Missing Firestore permission. Publish firestore.rules and reload.')
      } else {
        setError(subscriptionError.message || 'Failed to sync data from Firebase.')
      }
      setLoading(false)
    }

    const unsubscribeSubjects = subscribeToSubjects(
      user.uid,
      (items) => {
        setSubjectDocs(items)
        setLoading(false)
      },
      handleSubscriptionError
    )

    const unsubscribeTopics = subscribeToTopics(
      user.uid,
      (items) => setTopicDocs(items),
      handleSubscriptionError
    )

    const unsubscribeNotes = subscribeToNotes(
      user.uid,
      (items) => setNoteDocs(items),
      handleSubscriptionError
    )

    return () => {
      unsubscribeSubjects()
      unsubscribeTopics()
      unsubscribeNotes()
    }
  }, [isAuthenticated, user?.uid])

  const setFormField = useCallback((field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
  }, [])

  const openAdd = useCallback(() => {
    setForm(DEFAULT_FORM)
    setIsAddOpen(true)
  }, [])

  const openEdit = useCallback((subject) => {
    setForm({
      name: subject.name,
      description: subject.description,
      icon: subject.icon,
      color: subject.color,
    })
    setEditTarget(subject)
  }, [])

  const addSubject = useCallback(async () => {
    if (!form.name.trim()) return

    setError('')

    if (!isAuthenticated) {
      const newSubject = {
        id: uid(),
        name: form.name,
        description: form.description,
        icon: form.icon,
        color: form.color,
        aiScore: null,
        testsAttempted: 0,
        pdfs: [],
        topics: [],
      }

      setGuestSubjects((previous) => [...previous, newSubject])
      setIsAddOpen(false)
      setForm(DEFAULT_FORM)
      return
    }

    try {
      await createSubject(user.uid, {
        id: uid(),
        name: form.name,
        description: form.description,
        icon: form.icon,
        color: form.color,
        aiScore: null,
        testsAttempted: 0,
        pdfs: [],
        topicsCount: 0,
        notesCount: 0,
      })

      setIsAddOpen(false)
      setForm(DEFAULT_FORM)
    } catch (creationError) {
      console.error('Failed to create subject:', creationError)
      setError(creationError.message || 'Unable to create subject.')
    }
  }, [form, isAuthenticated, user?.uid])

  const editSubject = useCallback(async () => {
    if (!editTarget?.id) return

    setError('')

    if (!isAuthenticated) {
      setGuestSubjects((previous) =>
        previous.map((subject) =>
          subject.id === editTarget.id
            ? {
              ...subject,
              name: form.name,
              description: form.description,
              icon: form.icon,
              color: form.color,
            }
            : subject
        )
      )

      setEditTarget(null)
      setForm(DEFAULT_FORM)
      return
    }

    try {
      await updateSubjectDoc(user.uid, editTarget.id, {
        name: form.name,
        description: form.description,
        icon: form.icon,
        color: form.color,
      })

      setEditTarget(null)
      setForm(DEFAULT_FORM)
    } catch (updateError) {
      console.error('Failed to edit subject:', updateError)
      setError(updateError.message || 'Unable to edit subject.')
    }
  }, [editTarget?.id, form, isAuthenticated, user?.uid])

  const deleteSubject = useCallback(async (subjectId) => {
    if (!subjectId) return

    setError('')

    if (!isAuthenticated) {
      setGuestSubjects((previous) => previous.filter((subject) => subject.id !== subjectId))
      if (selected?.id === subjectId) {
        setSelected(null)
      }
      return
    }

    try {
      await deleteSubjectDoc(user.uid, subjectId)
      if (selected?.id === subjectId) {
        setSelected(null)
      }
    } catch (deletionError) {
      console.error('Failed to delete subject:', deletionError)
      setError(deletionError.message || 'Unable to delete subject.')
    }
  }, [isAuthenticated, selected?.id, user?.uid])

  const syncSubjectGraph = useCallback(async (previousSubject, nextSubject) => {
    const nextTopics = toSafeArray(nextSubject.topics)
    const totalNotes = nextTopics.reduce((sum, topic) => sum + toSafeArray(topic.notes).length, 0)

    await updateSubjectDoc(user.uid, nextSubject.id, {
      name: nextSubject.name,
      description: nextSubject.description,
      icon: nextSubject.icon,
      color: nextSubject.color,
      aiScore: nextSubject.aiScore ?? null,
      testsAttempted: Number.isFinite(nextSubject.testsAttempted) ? nextSubject.testsAttempted : 0,
      pdfs: toSafeArray(nextSubject.pdfs),
      topicsCount: nextTopics.length,
      notesCount: totalNotes,
    })

    const previousTopics = toSafeArray(previousSubject.topics)
    const previousTopicMap = new Map(previousTopics.map((topic) => [topic.id, topic]))
    const nextTopicMap = new Map(nextTopics.map((topic) => [topic.id, topic]))

    for (const previousTopic of previousTopics) {
      if (!nextTopicMap.has(previousTopic.id)) {
        await deleteTopic(user.uid, previousSubject.id, previousTopic.id)
      }
    }

    for (const nextTopicRaw of nextTopics) {
      const nextTopic = {
        ...nextTopicRaw,
        id: nextTopicRaw.id || uid(),
        name: String(nextTopicRaw.name || '').trim() || 'Untitled Topic',
        notes: toSafeArray(nextTopicRaw.notes),
      }

      const previousTopic = previousTopicMap.get(nextTopic.id)

      if (!previousTopic) {
        await createTopic(user.uid, {
          id: nextTopic.id,
          subjectId: nextSubject.id,
          name: nextTopic.name,
          questionsCount: nextTopic.questionsCount || 0,
          notesCount: nextTopic.notes.length,
        })

        await safeLogActivity(user.uid, {
          type: ACTIVITY_TYPES.TOPIC_CREATED,
          subjectId: nextSubject.id,
          topicId: nextTopic.id,
          timestamp: nextTopic.updatedAt || new Date().toISOString(),
        })
      } else if (topicIsDifferent(previousTopic, nextTopic)) {
        await updateTopicDoc(user.uid, nextSubject.id, nextTopic.id, {
          subjectId: nextSubject.id,
          name: nextTopic.name,
          questionsCount: nextTopic.questionsCount || 0,
          notesCount: nextTopic.notes.length,
        })
      }

      const previousNotes = toSafeArray(previousTopic?.notes)
      const previousNoteMap = new Map(previousNotes.map((note) => [note.id, note]))
      const nextNoteMap = new Map(nextTopic.notes.map((note) => [note.id, note]))

      for (const previousNote of previousNotes) {
        if (!nextNoteMap.has(previousNote.id)) {
          await deleteNote(user.uid, nextSubject.id, nextTopic.id, previousNote.id)
        }
      }

      for (const nextNoteRaw of nextTopic.notes) {
        const nextNote = normalizeNote(nextNoteRaw)
        const previousNote = previousNoteMap.get(nextNote.id)

        const notePayload = {
          id: nextNote.id,
          subjectId: nextSubject.id,
          topicId: nextTopic.id,
          title: nextNote.title,
          content: nextNote.content,
          blocks: nextNote.blocks,
          tags: nextNote.tags,
          isFavorite: nextNote.isFavorite,
          isPinned: nextNote.isPinned,
          linkedNotes: nextNote.linkedNotes,
          createdAt: nextNote.createdAt,
          updatedAt: nextNote.updatedAt,
          lastOpenedAt: nextNote.lastOpenedAt,
        }

        if (!previousNote) {
          await createNote(user.uid, notePayload)

          await safeLogActivity(user.uid, {
            type: ACTIVITY_TYPES.NOTE_CREATED,
            subjectId: nextSubject.id,
            topicId: nextTopic.id,
            noteId: nextNote.id,
            timestamp: nextNote.updatedAt || new Date().toISOString(),
          })

          continue
        }

        if (notesAreDifferent(previousNote, nextNote)) {
          await updateNoteDoc(user.uid, nextSubject.id, nextTopic.id, nextNote.id, {
            subjectId: nextSubject.id,
            topicId: nextTopic.id,
            title: nextNote.title,
            content: nextNote.content,
            blocks: nextNote.blocks,
            tags: nextNote.tags,
            isFavorite: nextNote.isFavorite,
            isPinned: nextNote.isPinned,
            linkedNotes: nextNote.linkedNotes,
            createdAt: nextNote.createdAt,
            updatedAt: nextNote.updatedAt,
            lastOpenedAt: nextNote.lastOpenedAt,
          })
        }
      }
    }
  }, [user?.uid])

  const updateSubject = useCallback(async (updatedSubject) => {
    if (!updatedSubject?.id) return

    setError('')

    if (!isAuthenticated) {
      setGuestSubjects((previous) => {
        const found = previous.some((subject) => subject.id === updatedSubject.id)
        if (!found) return [...previous, updatedSubject]
        return previous.map((subject) =>
          subject.id === updatedSubject.id ? updatedSubject : subject
        )
      })
      return
    }

    try {
      const previousSubject = subjects.find((subject) => subject.id === updatedSubject.id)

      if (!previousSubject) {
        await createSubject(user.uid, {
          id: updatedSubject.id,
          name: updatedSubject.name,
          description: updatedSubject.description,
          icon: updatedSubject.icon,
          color: updatedSubject.color,
          aiScore: updatedSubject.aiScore,
          testsAttempted: updatedSubject.testsAttempted,
          pdfs: updatedSubject.pdfs,
          topicsCount: 0,
          notesCount: 0,
        })

        await syncSubjectGraph({ ...updatedSubject, topics: [] }, updatedSubject)
        return
      }

      await syncSubjectGraph(previousSubject, updatedSubject)
    } catch (syncError) {
      console.error('Failed to sync subject graph:', syncError)
      setError(syncError.message || 'Unable to save your changes.')
    }
  }, [isAuthenticated, subjects, syncSubjectGraph, user?.uid])

  return {
    subjects,
    selected,
    form,
    isAddOpen,
    editTarget,
    loading,
    error,
    setSelected,
    setFormField,
    setIsAddOpen,
    setEditTarget,
    openAdd,
    openEdit,
    addSubject,
    editSubject,
    deleteSubject,
    updateSubject,
  }
}
