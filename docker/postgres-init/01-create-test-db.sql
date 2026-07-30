-- Runs once, only on first container start against a fresh volume (Postgres
-- only executes /docker-entrypoint-initdb.d/* when the data directory is
-- empty). Creates a second database dedicated to pytest, so the sample data
-- the backend entrypoint seeds into POSTGRES_DB never lands in the database
-- the test suite asserts exact row counts against.
CREATE DATABASE library_test_db;
