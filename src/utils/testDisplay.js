function toSafeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildSubjectMap(subjects = []) {
  return new Map(
    toSafeArray(subjects)
      .filter((subject) => subject?.id)
      .map((subject) => [subject.id, subject])
  )
}

function resolveMetadataSubjects(metadataSubjects, subjectMap) {
  const resolved = toSafeArray(metadataSubjects)
    .map((subjectRef) => {
      const liveSubject = subjectRef?.id ? subjectMap.get(subjectRef.id) : null
      if (!liveSubject) return subjectRef

      return {
        ...subjectRef,
        name: liveSubject.name || subjectRef?.name || 'Untitled Subject',
        color: liveSubject.color || subjectRef?.color,
        icon: liveSubject.icon || subjectRef?.icon,
      }
    })
    .filter(Boolean)

  if (resolved.length > 0) {
    return resolved
  }

  return []
}

function inferMetadataSubjects(test, subjectMap) {
  const subjectIds = new Set()

  toSafeArray(test?.questions).forEach((question) => {
    const subjectId = question?.sourceSubject || question?.subjectId || null
    if (subjectId) subjectIds.add(subjectId)
  })

  toSafeArray(test?.config?.subjectIds).forEach((subjectId) => {
    if (subjectId) subjectIds.add(subjectId)
  })

  return [...subjectIds]
    .map((subjectId) => subjectMap.get(subjectId))
    .filter(Boolean)
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      color: subject.color,
      icon: subject.icon,
    }))
}

function resolveMetadataTopics(metadataTopics, subjectMap) {
  return toSafeArray(metadataTopics).map((topic) => {
    const liveSubject = topic?.subjectId ? subjectMap.get(topic.subjectId) : null
    if (!liveSubject) return topic

    return {
      ...topic,
      subjectName: liveSubject.name || topic?.subjectName || 'Untitled Subject',
    }
  })
}

export function buildTestTitle(config = {}, metadata = {}) {
  if (config.scope === 'exam-source') {
    const examTitle = String(
      config.examTitle
      || metadata.examSource?.title
      || metadata.group?.name
      || metadata.examSource?.groupName
      || 'Custom Exam'
    ).trim()

    return examTitle || 'Custom Exam'
  }

  const subjectNames = toSafeArray(metadata.subjects)
    .map((subject) => String(subject?.name || '').trim())
    .filter(Boolean)
    .join(' + ')

  if (config.scope === 'selection') {
    const selectionTitle =
      metadata.selection?.noteTitle ||
      metadata.notes?.[0]?.title ||
      'Selected Text'

    return `${subjectNames || 'Study'} - ${selectionTitle} Selection Test`
  }

  if (config.scope === 'topic' && toSafeArray(metadata.topics).length === 1) {
    return `${subjectNames || 'Study'} - ${metadata.topics[0].name}`
  }

  if (config.scope === 'multi-subject') {
    return `Multi-Subject Test: ${subjectNames || 'Study'}`
  }

  return `${subjectNames || 'Study'} - Full Subject Test`
}

export function resolveTestDisplay(test, subjects = []) {
  if (!test || typeof test !== 'object') return test

  const subjectMap = buildSubjectMap(subjects)
  const metadata = test.metadata && typeof test.metadata === 'object' ? test.metadata : {}
  const resolvedSubjects = resolveMetadataSubjects(metadata.subjects, subjectMap)
  const metadataSubjects = resolvedSubjects.length > 0
    ? resolvedSubjects
    : inferMetadataSubjects(test, subjectMap)
  const metadataTopics = resolveMetadataTopics(metadata.topics, subjectMap)

  const resolvedQuestions = toSafeArray(test.questions).map((question) => {
    const subjectId = question?.sourceSubject || question?.subjectId || null
    const liveSubject = subjectId ? subjectMap.get(subjectId) : null
    if (!liveSubject) return question

    return {
      ...question,
      subjectName: liveSubject.name || question?.subjectName || 'Untitled Subject',
    }
  })

  const nextMetadata = {
    ...metadata,
    subjects: metadataSubjects,
    topics: metadataTopics,
  }

  const nextTitle = metadataSubjects.length > 0
    ? buildTestTitle(test.config || {}, nextMetadata)
    : (test.title || 'Untitled Test')

  return {
    ...test,
    title: nextTitle,
    questions: resolvedQuestions,
    metadata: nextMetadata,
  }
}
