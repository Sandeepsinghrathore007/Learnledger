import {
  getDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { uid } from '@/utils/id'
import { userDocRef, userExamGroupDocRef, userExamGroupsCol } from './firestorePaths'

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toIso(value) {
  return toDate(value)?.toISOString() || null
}

function normalizeSubjectIds(subjectIds) {
  if (!Array.isArray(subjectIds)) return []

  return [...new Set(subjectIds.map((value) => String(value || '').trim()).filter(Boolean))]
}

function normalizeExamGroup(snapshot) {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    userId: data.userId,
    name: data.name || 'Untitled Group',
    subjectIds: normalizeSubjectIds(data.subjectIds),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  }
}

function normalizeExamGroupRecord(record) {
  if (!record || typeof record !== 'object') return null

  return {
    id: String(record.id || uid()),
    userId: record.userId || null,
    name: String(record.name || '').trim() || 'Untitled Group',
    subjectIds: normalizeSubjectIds(record.subjectIds),
    createdAt: toIso(record.createdAt) || record.createdAt || null,
    updatedAt: toIso(record.updatedAt) || record.updatedAt || null,
  }
}

function normalizeExamGroupList(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeExamGroupRecord)
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
}

function isPermissionDenied(error) {
  return error?.code === 'permission-denied' || /insufficient permissions/i.test(String(error?.message || ''))
}

async function readExamGroupsFromUserDoc(userId) {
  const snapshot = await getDoc(userDocRef(userId))
  const data = snapshot.data() || {}
  return normalizeExamGroupList(data.examGroups)
}

async function writeExamGroupsToUserDoc(userId, updater) {
  const currentGroups = await readExamGroupsFromUserDoc(userId)
  const nextGroups = normalizeExamGroupList(updater(currentGroups))

  await setDoc(
    userDocRef(userId),
    {
      userId,
      examGroups: nextGroups.map((group) => ({
        id: group.id,
        userId: group.userId || userId,
        name: group.name,
        subjectIds: group.subjectIds,
        createdAt: group.createdAt || new Date().toISOString(),
        updatedAt: group.updatedAt || new Date().toISOString(),
      })),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  return nextGroups
}

export function subscribeToExamGroups(userId, onNext, onError) {
  let unsubscribe = () => {}
  let switchedToFallback = false

  const subscribeToUserDocFallback = () =>
    onSnapshot(
      userDocRef(userId),
      (snapshot) => {
        const data = snapshot.data() || {}
        onNext(normalizeExamGroupList(data.examGroups))
      },
      onError
    )

  unsubscribe = onSnapshot(
    userExamGroupsCol(userId),
    (snapshot) => {
      const items = snapshot.docs
        .map(normalizeExamGroup)
        .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))

      onNext(items)
    },
    (error) => {
      if (!switchedToFallback && isPermissionDenied(error)) {
        switchedToFallback = true
        unsubscribe = subscribeToUserDocFallback()
        return
      }

      onError?.(error)
    }
  )

  return () => unsubscribe()
}

export async function createExamGroup(userId, groupInput) {
  if (!userId) {
    throw new Error('createExamGroup requires an authenticated user id.')
  }

  const examGroupId = groupInput?.id || uid()
  const examGroupRef = userExamGroupDocRef(userId, examGroupId)

  const payload = {
    userId,
    name: String(groupInput?.name || '').trim() || 'Untitled Group',
    subjectIds: normalizeSubjectIds(groupInput?.subjectIds),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  try {
    await setDoc(examGroupRef, payload)
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error
    }

    const nowIso = new Date().toISOString()

    await writeExamGroupsToUserDoc(userId, (groups) => [
      {
        id: examGroupId,
        userId,
        name: String(groupInput?.name || '').trim() || 'Untitled Group',
        subjectIds: normalizeSubjectIds(groupInput?.subjectIds),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      ...groups.filter((group) => group.id !== examGroupId),
    ])
  }

  return {
    id: examGroupId,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function updateExamGroup(userId, examGroupId, updates) {
  if (!userId || !examGroupId) {
    throw new Error('updateExamGroup requires userId and examGroupId.')
  }

  const payload = {
    ...updates,
    updatedAt: serverTimestamp(),
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    payload.name = String(payload.name || '').trim() || 'Untitled Group'
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'subjectIds')) {
    payload.subjectIds = normalizeSubjectIds(payload.subjectIds)
  }

  try {
    await updateDoc(userExamGroupDocRef(userId, examGroupId), payload)
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error
    }

    const nowIso = new Date().toISOString()

    await writeExamGroupsToUserDoc(userId, (groups) =>
      groups.map((group) =>
        group.id === examGroupId
          ? {
              ...group,
              userId,
              name: Object.prototype.hasOwnProperty.call(payload, 'name')
                ? payload.name
                : group.name,
              subjectIds: Object.prototype.hasOwnProperty.call(payload, 'subjectIds')
                ? payload.subjectIds
                : group.subjectIds,
              updatedAt: nowIso,
            }
          : group
      )
    )
  }
}

export async function deleteExamGroup(userId, examGroupId) {
  if (!userId || !examGroupId) {
    throw new Error('deleteExamGroup requires userId and examGroupId.')
  }

  try {
    await deleteDoc(userExamGroupDocRef(userId, examGroupId))
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error
    }

    await writeExamGroupsToUserDoc(userId, (groups) =>
      groups.filter((group) => group.id !== examGroupId)
    )
  }
}
