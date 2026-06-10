"""Seed a conversation whose assistant turn carries a generated PDF.

Reuses the REAL backend code path (render_pdf → storage.put → attachments row
linked to the assistant message), so the seeded state is byte-for-byte what a
live ``create_pdf`` turn produces — but with NO LLM call. Lets the Playwright
BE↔FE cross-check run deterministically in CI.

Invoked by ``e2e/helpers/seed.ts`` with the BACKEND repo as cwd and
``PYTHONPATH=.`` + the throwaway DB's ``DATABASE_URL`` in the env. Prints one
JSON line: ``{"conversation_id", "attachment_id", "filename"}``.

Usage: ``uv run python seed_pdf_conversation.py <user-email>``
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid

# Rich markdown so the seeded PDF exercises headings, lists, callouts, code,
# and a table — the same surface a real architecture-guidance doc hits.
_MD = """## Overview

The platform follows clean architecture with four layers.

- Domain — pure python
- Application — use cases
- Infrastructure — adapters

> **NOTE — Keep layers isolated**
>
> The dependency rule is absolute: inner layers never import outer ones.

> **WARNING — Never hardcode provider names**
>
> Define provider names as constants.

```python
@LLMFactory.register("anthropic")
class AnthropicProvider: ...
```

| Layer | May import |
|---|---|
| Domain | nothing |
| Application | Domain |
"""

_FILENAME = "seeded-architecture-guidance.pdf"
_CONTENT_TYPE = "application/pdf"


async def _main(email: str) -> None:
    from sqlalchemy import select

    from src.application.use_cases.conversations.persist_turn import PersistTurn
    from src.domain.value_objects import MessageAppendEntry
    from src.infrastructure.database.engine import AsyncSessionFactory
    from src.infrastructure.database.orm.user import UserORM
    from src.infrastructure.database.repositories import (
        SqlAttachmentRepository,
        SqlConversationRepository,
        SqlMessageRepository,
    )
    from src.infrastructure.pdf import render_pdf
    from src.infrastructure.storage import get_storage_backend

    thread_id = str(uuid.uuid4())
    pdf_bytes = render_pdf(
        "Seeded Architecture Guidance", _MD,
        template_name="architecture_guidance",
    )

    async with AsyncSessionFactory() as session:
        user = (
            await session.execute(select(UserORM).where(UserORM.email == email))
        ).scalar_one()
        uid = user.id

        conv_repo = SqlConversationRepository(session)
        msg_repo = SqlMessageRepository(session)
        conv, _created = await conv_repo.get_or_create_by_thread_id(
            user_id=uid, flow_id=None, thread_id=thread_id, title=None,
            user_model_id=None, conversation_id=uuid.UUID(thread_id),
        )
        cid = conv.id

        persisted = await PersistTurn(
            conversation_repo=conv_repo, message_repo=msg_repo
        ).execute(
            user_id=uid, thread_id=thread_id, flow_id=None,
            entries=[
                MessageAppendEntry(role="user", content="Make me an architecture PDF."),
                MessageAppendEntry(role="assistant", content="Here is your PDF."),
            ],
        )
        assistant = next(m for m in persisted if m.role == "assistant")

        key_id = uuid.uuid4()
        storage_key = f"users/{uid}/{key_id}/{_FILENAME}"
        await get_storage_backend().put(storage_key, pdf_bytes, _CONTENT_TYPE)

        att_repo = SqlAttachmentRepository(session)
        attachment = await att_repo.create(
            user_id=uid, conversation_id=cid, filename=_FILENAME,
            content_type=_CONTENT_TYPE, size_bytes=len(pdf_bytes),
            storage_key=storage_key,
        )
        await att_repo.link_to_message(
            [attachment.id], message_id=assistant.id, conversation_id=cid
        )
        await session.commit()

    print(json.dumps({
        "conversation_id": str(cid),
        "attachment_id": str(attachment.id),
        "filename": _FILENAME,
    }))


if __name__ == "__main__":
    asyncio.run(_main(sys.argv[1] if len(sys.argv) > 1 else "verify@example.com"))
