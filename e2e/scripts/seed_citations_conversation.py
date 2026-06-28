"""Seed a deterministic *citations report* conversation — NO LLM call.

Mirrors ``seed_pdf_conversation.py`` but persists a plain assistant markdown
turn shaped like the backend's ``citations`` flow node output: synthesis prose
with inline numbered markers ``[1]``/``[2]`` followed by a ``## References``
section of ``[title](url)`` links. Lets the Playwright e2e verify the desktop
FE's external-open of References links (pragna2_desktop_app#99 / CF-051)
deterministically, without a deep-research run or any provider key.

Reuses the REAL backend persist path (``PersistTurn``) so the seeded state is
exactly what a live assistant turn produces. Invoked inside the BE container
(cwd ``/app``) with that container's own settings/env, so the row lands in the
DB the BE serves from.

Prints one JSON line: ``{"conversation_id"}``.

Usage: ``uv run python seed_citations_conversation.py <user-email>``
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid

# Citations-report markdown: inline [1]/[2] markers in prose (must render
# LITERAL, not links) + a "## References" section whose [title](url) links must
# open in the system browser. URLs are stable, well-known https targets.
_MD = """## Summary

The Apollo 11 mission landed the first humans on the Moon in July 1969 [1].
The broader Apollo program continued crewed lunar missions through 1972 [2].

## References

1. [NASA — Apollo 11 mission overview](https://www.nasa.gov/mission/apollo-11/)
2. [Wikipedia — Apollo program](https://en.wikipedia.org/wiki/Apollo_program)
"""

_USER_PROMPT = "Summarise the Apollo Moon landings with sources."


async def _main(email: str) -> None:
    from sqlalchemy import select

    from src.application.use_cases.conversations.persist_turn import PersistTurn
    from src.domain.value_objects import MessageAppendEntry
    from src.infrastructure.database.engine import AsyncSessionFactory
    from src.infrastructure.database.orm.user import UserORM
    from src.infrastructure.database.repositories import (
        SqlConversationRepository,
        SqlMessageRepository,
    )

    thread_id = str(uuid.uuid4())

    async with AsyncSessionFactory() as session:
        user = (
            await session.execute(select(UserORM).where(UserORM.email == email))
        ).scalar_one()
        uid = user.id

        conv_repo = SqlConversationRepository(session)
        msg_repo = SqlMessageRepository(session)
        conv, _created = await conv_repo.get_or_create_by_thread_id(
            user_id=uid, flow_id=None, thread_id=thread_id, title="Citations e2e",
            user_model_id=None, conversation_id=uuid.UUID(thread_id),
        )
        cid = conv.id

        await PersistTurn(
            conversation_repo=conv_repo, message_repo=msg_repo
        ).execute(
            user_id=uid, thread_id=thread_id, flow_id=None,
            entries=[
                MessageAppendEntry(role="user", content=_USER_PROMPT),
                MessageAppendEntry(role="assistant", content=_MD),
            ],
        )
        await session.commit()

    print(json.dumps({"conversation_id": str(cid)}))


if __name__ == "__main__":
    asyncio.run(_main(sys.argv[1] if len(sys.argv) > 1 else "test_user@example.com"))
