/**
 * This approach comes from snowpack-plugin-gren by Marc Walter
 * https://github.com/marc136/snowpack-plugin-gren
 *
 * To avoid gets an error: "It looks like some of the information cached in gren-stuff/ has been corrupted." from Gren compiler
 * Gren compiler uses gren-stuff dir for cache which is expected not to be touched by other thread's compilation
 */
const queue: (() => void)[] = []
let locked = false

export const acquireLock = async () => {
  await new Promise<void>((resolve) => {
    if (!locked) {
      resolve()
      return
    }
    queue.push(resolve)
  })

  locked = true

  return () => {
    queue.shift()?.()
    if (queue.length === 0) {
      locked = false
    }
  }
}
