/**
 * Configuration settings page.
 *
 * Holds per-user keys + deployment-style settings your workspace uses. Each
 * concern is a self-contained section card, so adding a new key (S3 bucket,
 * other provider keys, …) is a new `<Section />` here — no page rewrite.
 *
 * Section 1: the embedding (Voyage) key for Knowledge search.
 * Section 2: per-user Knowledge / retrieval tuning settings.
 * Section 3: per-browser chat-action toggles.
 */

import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { ChatActionsSection } from './ChatActionsSection';
import { EmbeddingKeySection } from './EmbeddingKeySection';
import { KnowledgeSettingsSection } from './KnowledgeSettingsSection';

/** Configuration settings page — keys and per-browser settings. */
export default function ConfigurationView() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold">
          <EntityIcon entity="configuration" size="lg" />
          Configuration
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keys and settings your workspace uses. These are stored securely and
          never shown again after you save them.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <EmbeddingKeySection />
        <KnowledgeSettingsSection />
        <ChatActionsSection />
        {/* Future sections (e.g. object storage / S3) slot in here. */}
      </div>
    </div>
  );
}
