export const RESOURCE_TEST_PATH = 'BackUp/OshiNote-ResourceTest'
export const isResourceTest = import.meta.env.VITE_RESOURCE_TEST === 'true'

export function assertTestRemotePath(path: string, isolated = isResourceTest) {
  if (!isolated) return
  if (path.replace(/^\/+|\/+$/g, '') !== RESOURCE_TEST_PATH) {
    throw new Error(`Resource test builds only use ${RESOURCE_TEST_PATH}.`)
  }
}
