from enum import StrEnum


class SortDir(StrEnum):
    """Sort direction for list queries.

    Lives in `core` rather than `api` so the repository layer can accept it
    without importing from the web layer.
    """

    ASC = "asc"
    DESC = "desc"
