/**
 * Delegation coverage for the thin application services — each is a facade that
 * forwards to its repository port. One assertion per method: called with the
 * same args, result passed through. (ConversationService + AuthService have
 * their own dedicated files.)
 */
import { describe, it, expect, vi } from 'vitest';
import { AgentService } from './AgentService';
import { AttachmentService } from './AttachmentService';
import { EmbeddingKeyService } from './EmbeddingKeyService';
import { EpisodeService } from './EpisodeService';
import { FlowService } from './FlowService';
import { KnowledgeService } from './KnowledgeService';
import { LlmProviderService } from './LlmProviderService';
import { McpConnectorService } from './McpConnectorService';
import { ModelService } from './ModelService';
import { PragnaFlowService } from './PragnaFlowService';
import { ProviderService } from './ProviderService';
import { ToolService } from './ToolService';

/** A repo stub where every accessed method is a resolved vi.fn(). */
function stubRepo(): any {
  return new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, prop: string) => {
        if (!(prop in target)) target[prop] = vi.fn().mockResolvedValue(`R:${prop}`);
        return target[prop];
      },
    },
  );
}

describe('service delegations', () => {
  it('AgentService forwards to the repo', async () => {
    const repo = stubRepo();
    const svc = new AgentService(repo);
    await svc.list(true);
    expect(repo.list).toHaveBeenCalledWith(true);
    await svc.get('a1');
    expect(repo.get).toHaveBeenCalledWith('a1');
    await svc.create({ apiName: 'r', displayName: 'R' } as never);
    expect(repo.create).toHaveBeenCalled();
    await svc.update('a1', { displayName: 'X' } as never);
    expect(repo.update).toHaveBeenCalledWith('a1', { displayName: 'X' });
    await svc.setDefault('a1');
    expect(repo.setDefault).toHaveBeenCalledWith('a1');
    await svc.archive('a1');
    expect(repo.archive).toHaveBeenCalledWith('a1');
    await svc.attachConnector('a1', { mcpConnectorId: 'mc1' } as never);
    expect(repo.attachConnector).toHaveBeenCalledWith('a1', { mcpConnectorId: 'mc1' });
  });

  it('AttachmentService forwards upload + fetchContent', async () => {
    const repo = stubRepo();
    const svc = new AttachmentService(repo);
    const file = new File(['x'], 'f.txt');
    await svc.upload('c1', file);
    expect(repo.upload).toHaveBeenCalledWith('c1', file);
    await svc.fetchContent('a1');
    expect(repo.fetchContent).toHaveBeenCalledWith('a1');
  });

  it('EmbeddingKeyService forwards status/set/clear', async () => {
    const repo = stubRepo();
    const svc = new EmbeddingKeyService(repo);
    await svc.getStatus();
    expect(repo.getStatus).toHaveBeenCalled();
    await svc.setKey('k');
    expect(repo.setKey).toHaveBeenCalledWith('k');
    await svc.clearKey();
    expect(repo.clearKey).toHaveBeenCalled();
  });

  it('EpisodeService forwards list + get', async () => {
    const repo = stubRepo();
    const svc = new EpisodeService(repo);
    await svc.list('c1', { limit: 1 });
    expect(repo.list).toHaveBeenCalledWith('c1', { limit: 1 });
    await svc.get('c1', 'e1');
    expect(repo.get).toHaveBeenCalledWith('c1', 'e1');
  });

  it('FlowService forwards every method', async () => {
    const repo = stubRepo();
    const svc = new FlowService(repo);
    await svc.list();
    expect(repo.list).toHaveBeenCalled();
    await svc.get('f1');
    expect(repo.get).toHaveBeenCalledWith('f1');
    await svc.create({ apiName: 'a', displayName: 'A', description: null } as never);
    expect(repo.create).toHaveBeenCalled();
    await svc.delete('f1');
    expect(repo.delete).toHaveBeenCalledWith('f1');
    await svc.validateYaml('y');
    expect(repo.validateYaml).toHaveBeenCalledWith('y');
    await svc.saveFromYaml('y');
    expect(repo.saveFromYaml).toHaveBeenCalledWith('y');
    await svc.saveFromYamlById('f1', 'y');
    expect(repo.saveFromYamlById).toHaveBeenCalledWith('f1', 'y');
    await svc.updateSlashExposure('f1', { exposedAsSlash: true });
    expect(repo.updateSlashExposure).toHaveBeenCalledWith('f1', { exposedAsSlash: true });
  });

  it('KnowledgeService forwards library + source + agent-binding methods', async () => {
    const repo = stubRepo();
    const svc = new KnowledgeService(repo);
    await svc.listLibraries();
    expect(repo.listLibraries).toHaveBeenCalled();
    await svc.createLibrary({ slug: 's', name: 'N' });
    expect(repo.createLibrary).toHaveBeenCalledWith({ slug: 's', name: 'N' });
    await svc.archiveLibrary('l1');
    expect(repo.archiveLibrary).toHaveBeenCalledWith('l1');
    await svc.listSources('l1');
    expect(repo.listSources).toHaveBeenCalledWith('l1');
    await svc.deleteSource('l1', 's1');
    expect(repo.deleteSource).toHaveBeenCalledWith('l1', 's1');
    await svc.attachAgentLibrary('a1', { libraryId: 'l1' });
    expect(repo.attachAgentLibrary).toHaveBeenCalledWith('a1', { libraryId: 'l1' });
  });

  it('LlmProviderService forwards listAll + listWithRegistrations', async () => {
    const repo = stubRepo();
    const svc = new LlmProviderService(repo);
    await svc.listAll();
    expect(repo.listAll).toHaveBeenCalled();
    await svc.listWithRegistrations();
    expect(repo.listWithRegistrations).toHaveBeenCalled();
  });

  it('McpConnectorService forwards every method', async () => {
    const repo = stubRepo();
    const svc = new McpConnectorService(repo);
    await svc.list();
    expect(repo.list).toHaveBeenCalled();
    await svc.register({ displayName: 'X', transport: 'http', config: {}, authType: 'none' } as never);
    expect(repo.register).toHaveBeenCalled();
    await svc.update('mc1', { displayName: 'Y' });
    expect(repo.update).toHaveBeenCalledWith('mc1', { displayName: 'Y' });
    await svc.archive('mc1');
    expect(repo.archive).toHaveBeenCalledWith('mc1');
    await svc.refreshTools('mc1');
    expect(repo.refreshTools).toHaveBeenCalledWith('mc1');
    await svc.startOAuth('mc1', {});
    expect(repo.startOAuth).toHaveBeenCalledWith('mc1', {});
  });

  it('ModelService forwards list/update/bulkUpdate', async () => {
    const repo = stubRepo();
    const svc = new ModelService(repo);
    await svc.list();
    expect(repo.list).toHaveBeenCalled();
    await svc.update('m1', { enabled: true });
    expect(repo.update).toHaveBeenCalledWith('m1', { enabled: true });
    await svc.bulkUpdate([{ id: 'm1', enabled: false }]);
    expect(repo.bulkUpdate).toHaveBeenCalledWith([{ id: 'm1', enabled: false }]);
  });

  it('PragnaFlowService forwards listSlashFlows', async () => {
    const repo = stubRepo();
    const svc = new PragnaFlowService(repo);
    await svc.listSlashFlows();
    expect(repo.listSlashFlows).toHaveBeenCalled();
  });

  it('ProviderService forwards every method', async () => {
    const repo = stubRepo();
    const svc = new ProviderService(repo);
    await svc.list();
    expect(repo.list).toHaveBeenCalled();
    await svc.register({ llmProviderId: 'lp1', apiKey: 'k' });
    expect(repo.register).toHaveBeenCalledWith({ llmProviderId: 'lp1', apiKey: 'k' });
    await svc.refreshModels('up1');
    expect(repo.refreshModels).toHaveBeenCalledWith('up1');
    await svc.toggle('up1', false);
    expect(repo.toggle).toHaveBeenCalledWith('up1', false);
    await svc.delete('up1');
    expect(repo.delete).toHaveBeenCalledWith('up1');
  });

  it('ToolService forwards list + setEnabled', async () => {
    const repo = stubRepo();
    const svc = new ToolService(repo);
    await svc.list();
    expect(repo.list).toHaveBeenCalled();
    await svc.setEnabled('t1', { enabled: true });
    expect(repo.setEnabled).toHaveBeenCalledWith('t1', { enabled: true });
  });
});
