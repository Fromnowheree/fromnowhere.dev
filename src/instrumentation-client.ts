/**
 * Runs in the browser before the site becomes interactive (Next's instrumentation-client).
 *
 * Development only: React's dev build draws Server Components on the browser's Performance
 * panel, and when a server component ends in an error (a page calling `notFound()`, which is how
 * every 404 here is made) or its stream is cut short (navigating away mid-render), it can ask for
 * a measure that ends before the page's time origin. `performance.measure` then throws
 * "cannot have a negative time stamp" as an uncaught error (Next 16.4.6, React 19.3.1). That one
 * measure is skipped instead; every other call goes through unchanged. Production builds draw no
 * such measures, and this code is not in them.
 */
if (process.env.NODE_ENV === 'development' && typeof performance !== 'undefined') {
  const measure = performance.measure.bind(performance)
  performance.measure = ((...args: Parameters<Performance['measure']>) => {
    try {
      return measure(...args)
    } catch (error) {
      if (error instanceof TypeError && /negative time stamp/.test(error.message))
        return undefined as unknown as PerformanceMeasure
      throw error
    }
  }) as Performance['measure']
}
