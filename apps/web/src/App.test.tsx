import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('redirects an unauthenticated visitor to the login screen', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /Sign in to your account/i }),
    ).toBeInTheDocument()
  })
})
