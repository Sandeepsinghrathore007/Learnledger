import { collection, doc } from 'firebase/firestore'
import { db } from './firebaseConfig'

export const userDocRef = (userId) => doc(db, 'users', userId)

export const userSubjectsCol = (userId) => collection(db, 'users', userId, 'subjects')
export const userSubjectDocRef = (userId, subjectId) => doc(db, 'users', userId, 'subjects', subjectId)

export const userTopicsCol = (userId, subjectId) =>
  collection(db, 'users', userId, 'subjects', subjectId, 'topics')
export const userTopicDocRef = (userId, subjectId, topicId) =>
  doc(db, 'users', userId, 'subjects', subjectId, 'topics', topicId)

export const userPdfKnowledgeCol = (userId, subjectId) =>
  collection(db, 'users', userId, 'subjects', subjectId, 'pdfKnowledge')
export const userPdfKnowledgeDocRef = (userId, subjectId, pdfId) =>
  doc(db, 'users', userId, 'subjects', subjectId, 'pdfKnowledge', pdfId)

export const userPdfKnowledgeChunksCol = (userId, subjectId, pdfId) =>
  collection(db, 'users', userId, 'subjects', subjectId, 'pdfKnowledge', pdfId, 'chunks')
export const userPdfKnowledgeChunkDocRef = (userId, subjectId, pdfId, chunkId) =>
  doc(db, 'users', userId, 'subjects', subjectId, 'pdfKnowledge', pdfId, 'chunks', chunkId)

export const userNotesCol = (userId, subjectId, topicId) =>
  collection(db, 'users', userId, 'subjects', subjectId, 'topics', topicId, 'notes')
export const userNoteDocRef = (userId, subjectId, topicId, noteId) =>
  doc(db, 'users', userId, 'subjects', subjectId, 'topics', topicId, 'notes', noteId)

export const userTestsCol = (userId) => collection(db, 'users', userId, 'tests')
export const userTestDocRef = (userId, testId) => doc(db, 'users', userId, 'tests', testId)

export const userAIChatsCol = (userId) => collection(db, 'users', userId, 'aiChats')
export const userAIChatDocRef = (userId, chatId) => doc(db, 'users', userId, 'aiChats', chatId)

export const userActivityCol = (userId) => collection(db, 'users', userId, 'activity')
export const userActivityDocRef = (userId, activityId) => doc(db, 'users', userId, 'activity', activityId)
