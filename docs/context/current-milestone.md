# Current Task: Task 2.1 — User Settings

## What I'm implementing
UserSettings model, auto-create on signup, GET/PATCH /settings endpoint.

## Files I'm working in
backend/app/models/user_settings.py
backend/alembic/versions/0002_user_settings.py
backend/app/routers/settings.py
backend/app/schemas/settings.py
backend/tests/test_settings.py

## Key constraints to remember
- UserSettings PK = user_id (1:1 with User, not a separate UUID)
- Auto-created when user is created (in setup + accept-invite endpoints)
- Fields: primary_currency (str, default "INR"), timezone (str, default "Asia/Kolkata"),
  date_format (str, default "DD/MM/YYYY"), number_format (str, default "en-IN"), updated_at TIMESTAMPTZ
- GET /settings: requires auth, returns current user's settings
- PATCH /settings: partial update, all fields optional
- Tests: defaults on user create, scoping (user A can't read user B's settings)

## Definition of done
pytest passes for settings tests
