"""Shared test utilities."""
from httpx import AsyncClient


async def register_second_user(
    client: AsyncClient,
    admin_headers: dict[str, str],
    email: str = "other@example.com",
    password: str = "password123",
) -> dict[str, str]:
    """Create a second user via invite flow and return their auth headers."""
    invite_resp = await client.post(
        "/api/v1/auth/invites",
        json={"email": email},
        headers=admin_headers,
    )
    assert invite_resp.status_code == 201, invite_resp.text
    invite_token = invite_resp.json()["token"]

    reg_resp = await client.post(
        "/api/v1/auth/accept-invite",
        json={"token": invite_token, "email": email, "password": password},
    )
    assert reg_resp.status_code == 201, reg_resp.text
    return {"Authorization": f"Bearer {reg_resp.json()['access_token']}"}
