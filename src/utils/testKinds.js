export const TEST_KIND = {
  MOCK: 'mock',
  EXAM: 'exam',
}

export function getTestKind(test) {
  const metadataKind = String(test?.metadata?.testType || '').trim().toLowerCase()
  if (metadataKind === TEST_KIND.EXAM) return TEST_KIND.EXAM
  if (metadataKind === TEST_KIND.MOCK) return TEST_KIND.MOCK

  const scope = String(test?.config?.scope || '').trim().toLowerCase()
  if (scope === 'exam-source') return TEST_KIND.EXAM

  return TEST_KIND.MOCK
}

export function isExamTest(test) {
  return getTestKind(test) === TEST_KIND.EXAM
}

export function isMockTest(test) {
  return getTestKind(test) === TEST_KIND.MOCK
}
