import { describe, it, expect, vi } from 'vitest';
import { ConversationService } from './ConversationService';
import type { IConversationRepository } from '@/application/ports/IConversationRepository';

function makeRepo() {
  return {
    list: vi.fn().mockResolvedValue(['L']),
    get: vi.fn().mockResolvedValue('G'),
    create: vi.fn().mockResolvedValue('C'),
    getMessages: vi.fn().mockResolvedValue(['M']),
    update: vi.fn().mockResolvedValue('U'),
    delete: vi.fn().mockResolvedValue(undefined),
    truncateFrom: vi.fn().mockResolvedValue(undefined),
    branch: vi.fn().mockResolvedValue('B'),
    getUsage: vi.fn().mockResolvedValue('USAGE'),
  } as unknown as IConversationRepository;
}

describe('ConversationService delegations', () => {
  it('forwards every method to the repository', async () => {
    const repo = makeRepo();
    const svc = new ConversationService(repo);

    expect(await svc.list({ limit: 5 })).toEqual(['L']);
    expect(repo.list).toHaveBeenCalledWith({ limit: 5 });

    expect(await svc.get('c1')).toBe('G');
    expect(repo.get).toHaveBeenCalledWith('c1');

    await svc.create({ threadId: 't1' });
    expect(repo.create).toHaveBeenCalledWith({ threadId: 't1' });

    await svc.getMessages('c1');
    expect(repo.getMessages).toHaveBeenCalledWith('c1');

    await svc.update('c1', { title: 'x' });
    expect(repo.update).toHaveBeenCalledWith('c1', { title: 'x' });

    await svc.delete('c1');
    expect(repo.delete).toHaveBeenCalledWith('c1');

    await svc.truncateFrom('c1', 'm1');
    expect(repo.truncateFrom).toHaveBeenCalledWith('c1', 'm1');

    await svc.branch('c1', 'm1');
    expect(repo.branch).toHaveBeenCalledWith('c1', 'm1');

    expect(await svc.getUsage('c1')).toBe('USAGE');
    expect(repo.getUsage).toHaveBeenCalledWith('c1');
  });
});
