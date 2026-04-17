"""Initial schema — all 10 modules

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-17

This migration creates the entire initial schema by leveraging the SQLAlchemy
ORM model definitions. All tables (tenants, restaurants, users, menu, orders,
tables, reservations, KDS, inventory, staff, customers, accounting) are
created in dependency order via Base.metadata.create_all.
"""
from alembic import op
import sqlalchemy as sa
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.database import Base
import app.models  # noqa: F401  — register all model tables

revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
