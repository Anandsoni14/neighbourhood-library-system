"""category table and book is_archived

Revision ID: 7f3c1a9e5b02
Revises: 996e4dceab29
Create Date: 2026-07-31 00:00:00.000000

Extracts book.category (a free-text String(80)) into a real `category` table
with a FK from `book.category_id`, and adds `book.is_archived` so books are
archived instead of deleted.

Backfill is case-sensitive on purpose: "Tech" and "tech" become two distinct
category rows rather than being folded together. Folding them would have to
pick one spelling as canonical, silently discarding whichever the librarian
didn't happen to type first — two near-duplicate rows are visible and
mergeable from the UI afterwards; a wrong merge during a migration is not
recoverable. Blank/whitespace-only values are dropped rather than becoming an
empty-string category.

downgrade() is lossy: it repopulates book.category from the FK but discards
category.description, category.is_archived, and any category with zero books
(nothing pointed at it to backfill from).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7f3c1a9e5b02"
down_revision: str | Sequence[str] | None = "996e4dceab29"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "category",
        sa.Column(
            "category_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("category_id"),
        sa.UniqueConstraint("name", name="uq_category_name"),
    )
    op.create_index("idx_category_is_archived", "category", ["is_archived"], unique=False)

    op.add_column("book", sa.Column("category_id", sa.UUID(), nullable=True))

    # Backfill: one category row per distinct trimmed, non-blank free-text
    # value, then point every book at the row matching its (trimmed) value.
    op.execute(
        sa.text(
            """
            INSERT INTO category (name)
            SELECT DISTINCT btrim(category) FROM book
            WHERE category IS NOT NULL AND btrim(category) <> ''
            ON CONFLICT (name) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE book b SET category_id = c.category_id
            FROM category c WHERE btrim(b.category) = c.name
            """
        )
    )

    op.create_foreign_key(
        "fk_book_category_id",
        "book",
        "category",
        ["category_id"],
        ["category_id"],
        ondelete="RESTRICT",
    )
    op.create_index("idx_book_category_id", "book", ["category_id"], unique=False)
    op.drop_column("book", "category")

    op.add_column(
        "book",
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_index("idx_book_is_archived", "book", ["is_archived"], unique=False)


def downgrade() -> None:
    """Downgrade schema. Lossy — see module docstring."""
    op.drop_index("idx_book_is_archived", table_name="book")
    op.drop_column("book", "is_archived")

    op.add_column("book", sa.Column("category", sa.String(length=80), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE book b SET category = c.name
            FROM category c WHERE b.category_id = c.category_id
            """
        )
    )

    op.drop_index("idx_book_category_id", table_name="book")
    op.drop_constraint("fk_book_category_id", "book", type_="foreignkey")
    op.drop_column("book", "category_id")

    op.drop_index("idx_category_is_archived", table_name="category")
    op.drop_table("category")
