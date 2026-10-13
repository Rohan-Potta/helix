"""convert task status and priority to native enums

Revision ID: f77ab71235be
Revises: 94e4a99d3bc9
Create Date: 2026-10-13 17:07:26.998091

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f77ab71235be'
down_revision: Union[str, Sequence[str], None] = '94e4a99d3bc9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

task_status_enum = postgresql.ENUM("todo", "in_progress", "done", name="taskstatus")
task_priority_enum = postgresql.ENUM("low", "medium", "high", name="taskpriority")


def upgrade() -> None:
    """Upgrade schema."""
    task_status_enum.create(op.get_bind())
    task_priority_enum.create(op.get_bind())

    op.alter_column(
        "tasks",
        "status",
        existing_type=sa.VARCHAR(length=20),
        type_=task_status_enum,
        postgresql_using="status::taskstatus",
        existing_nullable=False,
    )
    op.alter_column(
        "tasks",
        "priority",
        existing_type=sa.VARCHAR(length=20),
        type_=task_priority_enum,
        postgresql_using="priority::taskpriority",
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "tasks",
        "status",
        existing_type=task_status_enum,
        type_=sa.VARCHAR(length=20),
        postgresql_using="status::text",
        existing_nullable=False,
    )
    op.alter_column(
        "tasks",
        "priority",
        existing_type=task_priority_enum,
        type_=sa.VARCHAR(length=20),
        postgresql_using="priority::text",
        existing_nullable=False,
    )

    task_status_enum.drop(op.get_bind())
    task_priority_enum.drop(op.get_bind())
