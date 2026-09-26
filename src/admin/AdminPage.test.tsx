import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell } from '../app/AppShell'
import { createTestRepository } from '../test/testRepository'
describe('administrator workflow', () => {
  it('approves pending proof', async () => {
    render(<AppShell repository={createTestRepository({ admin:true,pending:true })} />)
    fireEvent.click(await screen.findByRole('button', { name:/command/i }))
    fireEvent.click(await screen.findByRole('button', { name:'Approve' }))
    expect(await screen.findByText('XP confirmed.')).toBeInTheDocument()
  })
  it('configures an idea using the same rules as the catalog', async () => {
    const repository=createTestRepository({ admin:true,pendingIdea:true })
    render(<AppShell repository={repository} />)
    fireEvent.click(await screen.findByRole('button', { name:/command/i }))
    fireEvent.click(await screen.findByRole('button', { name:'Configure and publish' }))
    fireEvent.change(screen.getByLabelText('XP bonus at baseline'), { target:{ value:'15' } })
    fireEvent.click(screen.getByLabelText('Require proof approval'))
    fireEvent.click(screen.getByRole('button', { name:'Save challenge' }))
    await screen.findByText('Challenge saved.')
    expect((await repository.getChallengeCatalog()).find((c)=>c.title==='Read before bed')).toMatchObject({
      rules:{ targetBonus:15,approval:true },category:'mind',
    })
  })
  it('rejects an idea without publishing', async () => {
    const repository=createTestRepository({ admin:true,pendingIdea:true })
    render(<AppShell repository={repository} />)
    fireEvent.click(await screen.findByRole('button', { name:/command/i }))
    fireEvent.click(await screen.findByRole('button', { name:'Reject' }))
    await waitFor(()=>expect(screen.queryByText('Read before bed')).not.toBeInTheDocument())
    expect((await repository.getChallengeCatalog()).some((c)=>c.title==='Read before bed')).toBe(false)
  })
  it('hides command access from players', async () => {
    render(<AppShell repository={createTestRepository()} />)
    await screen.findByLabelText('Challenge filters')
    expect(screen.queryByRole('button', { name:/command/i })).not.toBeInTheDocument()
  })
})
