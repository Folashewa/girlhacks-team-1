import { describe, expect, it } from 'vitest'
import { render } from '../prerender-entry'

describe('grove pages', () => {
  it('/g/demo renders from the bundled fixture, with labelled, focusable elements', () => {
    const html = render('/g/demo')
    expect(html).toContain('GirlHacks team')
    expect(html).toContain('aria-label="Idea from Priya: Make it live in the group chat instead of an app"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('See as list')
  })

  it('the landing links to the demo and leaks no grove keys or listing', () => {
    const html = render('/')
    expect(html).toContain('href="/g/demo"')
    expect(html).not.toMatch(/\/g\/[0-9a-f]{32}/)
  })
})
