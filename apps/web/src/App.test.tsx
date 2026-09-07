import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the landing page with every product listed', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /Operaciones contables, coordinadas en un solo producto\./,
      }),
    ).toBeInTheDocument()

    for (const product of ['Refine', 'Supabase', 'Kestra', 'Superset']) {
      expect(screen.getByRole('heading', { name: product })).toBeInTheDocument()
    }
  })
})
