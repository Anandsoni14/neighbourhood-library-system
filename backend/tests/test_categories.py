from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from services.category import CategoryService


@pytest.fixture
async def category_service(db: AsyncSession) -> CategoryService:
    return CategoryService(db)


class TestCategoryService:
    """Test CategoryService business logic."""

    async def test_create_category(self, category_service: CategoryService) -> None:
        category = await category_service.create_category(name="Fiction", description="Novels")
        assert category.name == "Fiction"
        assert category.description == "Novels"
        assert category.is_archived is False

    async def test_create_category_duplicate_name_raises_conflict(
        self, category_service: CategoryService
    ) -> None:
        await category_service.create_category(name="Duplicate Name")
        with pytest.raises(ConflictError):
            await category_service.create_category(name="Duplicate Name")

    async def test_create_category_name_is_case_sensitive(
        self, category_service: CategoryService
    ) -> None:
        """ "Tech" and "tech" are distinct categories, matching the migration's
        backfill rule — folding case here would contradict that."""
        await category_service.create_category(name="Tech")
        different = await category_service.create_category(name="tech")
        assert different.name == "tech"

    async def test_get_category_not_found_raises(self, category_service: CategoryService) -> None:
        with pytest.raises(NotFoundError):
            await category_service.get_category(uuid4())

    async def test_list_categories_excludes_archived_by_default(
        self, category_service: CategoryService
    ) -> None:
        active = await category_service.create_category(name="List Default Active")
        archived = await category_service.create_category(name="List Default Archived")
        await category_service.archive_category(archived.category_id)

        results, _total = await category_service.list_categories(name="List Default")

        ids = {c.category_id for c in results}
        assert active.category_id in ids
        assert archived.category_id not in ids

    async def test_list_categories_include_archived(
        self, category_service: CategoryService
    ) -> None:
        active = await category_service.create_category(name="List Include Active")
        archived = await category_service.create_category(name="List Include Archived")
        await category_service.archive_category(archived.category_id)

        results, total = await category_service.list_categories(
            name="List Include", include_archived=True
        )

        assert total == 2
        assert {active.category_id, archived.category_id} == {c.category_id for c in results}

    async def test_update_category(self, category_service: CategoryService) -> None:
        category = await category_service.create_category(name="Original Name")
        updated = await category_service.update_category(
            category.category_id, name="Renamed", description="New description"
        )
        assert updated.name == "Renamed"
        assert updated.description == "New description"

    async def test_update_category_duplicate_name_raises_conflict(
        self, category_service: CategoryService
    ) -> None:
        await category_service.create_category(name="Taken Name")
        other = await category_service.create_category(name="Free Name")
        with pytest.raises(ConflictError):
            await category_service.update_category(other.category_id, name="Taken Name")

    async def test_archive_category_is_idempotent(self, category_service: CategoryService) -> None:
        category = await category_service.create_category(name="Idempotent Archive")
        await category_service.archive_category(category.category_id)
        archived_again = await category_service.archive_category(category.category_id)
        assert archived_again.is_archived is True

    async def test_unarchive_category_restores(self, category_service: CategoryService) -> None:
        category = await category_service.create_category(name="Unarchive Me")
        await category_service.archive_category(category.category_id)
        restored = await category_service.unarchive_category(category.category_id)
        assert restored.is_archived is False


class TestCategoriesAPI:
    """Test Categories API endpoints."""

    async def test_create_category_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/categories",
            json={"name": "API Fiction", "description": "Novels and stories"},
            headers=librarian_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "API Fiction"
        assert data["is_archived"] is False

    async def test_create_category_endpoint_no_token_401(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/categories", json={"name": "No Token Category"})
        assert response.status_code == 401

    async def test_create_category_endpoint_duplicate_name_409(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        await client.post(
            "/api/v1/categories", json={"name": "Dup API Category"}, headers=librarian_headers
        )
        response = await client.post(
            "/api/v1/categories", json={"name": "Dup API Category"}, headers=librarian_headers
        )
        assert response.status_code == 409

    async def test_get_category_not_found(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.get(f"/api/v1/categories/{uuid4()}", headers=librarian_headers)
        assert response.status_code == 404

    async def test_list_categories_endpoint_excludes_archived_by_default(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_resp = await client.post(
            "/api/v1/categories", json={"name": "List Endpoint Archived"}, headers=librarian_headers
        )
        category_id = create_resp.json()["category_id"]
        await client.post(f"/api/v1/categories/{category_id}/archive", headers=librarian_headers)

        response = await client.get(
            "/api/v1/categories",
            params={"name": "List Endpoint Archived"},
            headers=librarian_headers,
        )
        assert response.json()["total"] == 0

        included_response = await client.get(
            "/api/v1/categories",
            params={"name": "List Endpoint Archived", "include_archived": "true"},
            headers=librarian_headers,
        )
        assert included_response.json()["total"] == 1

    async def test_update_category_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_resp = await client.post(
            "/api/v1/categories", json={"name": "Update Me"}, headers=librarian_headers
        )
        category_id = create_resp.json()["category_id"]

        response = await client.put(
            f"/api/v1/categories/{category_id}",
            json={"name": "Updated Name"},
            headers=librarian_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    async def test_archive_and_unarchive_category_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_resp = await client.post(
            "/api/v1/categories", json={"name": "Archive Cycle"}, headers=librarian_headers
        )
        category_id = create_resp.json()["category_id"]

        archive_response = await client.post(
            f"/api/v1/categories/{category_id}/archive", headers=librarian_headers
        )
        assert archive_response.status_code == 200
        assert archive_response.json()["is_archived"] is True

        unarchive_response = await client.post(
            f"/api/v1/categories/{category_id}/unarchive", headers=librarian_headers
        )
        assert unarchive_response.status_code == 200
        assert unarchive_response.json()["is_archived"] is False

    async def test_delete_category_endpoint_does_not_exist(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """No DELETE route at all: book.category_id is ondelete=RESTRICT, so a
        delete would always 409 for any category that has ever been used.
        Archive is the reversible equivalent the UI actually needs."""
        create_resp = await client.post(
            "/api/v1/categories", json={"name": "No Delete Route"}, headers=librarian_headers
        )
        category_id = create_resp.json()["category_id"]

        response = await client.delete(
            f"/api/v1/categories/{category_id}", headers=librarian_headers
        )
        assert response.status_code == 405
