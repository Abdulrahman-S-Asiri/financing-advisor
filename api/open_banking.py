"""Open Banking gateway boundary.

The current implementation talks to the mock AIS service over HTTP. The rest
of the API should not care whether the upstream provider is the local mock or
a licensed production TPP.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

import httpx


class OpenBankingProviderError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _field(raw: dict, *keys: str) -> Any:
    for key in keys:
        value = raw.get(key)
        if value not in (None, ""):
            return value
    raise KeyError(f"Missing required field. Expected one of: {', '.join(keys)}")


def _account_id(account: dict) -> str:
    return str(_field(account, "AccountId", "accountId"))


def _servicer_name(account: dict) -> str:
    servicer = _field(account, "Servicer", "servicer")
    if isinstance(servicer, dict):
        return str(_field(servicer, "Name", "name"))
    return str(servicer)


class OpenBankingGateway:
    def __init__(
        self,
        *,
        base_url: str,
        client_factory: Callable[[], httpx.Client] | None = None,
    ):
        self.base_url = base_url
        self._client_factory = client_factory

    def _client(self) -> httpx.Client:
        if self._client_factory is not None:
            return self._client_factory()
        return httpx.Client(base_url=self.base_url, timeout=10)

    def fetch_transactions(self, persona_id: str) -> tuple[str, list[dict]]:
        try:
            with self._client() as client:
                consent = client.post("/consents", json={"persona_id": persona_id})
                if consent.status_code == 404:
                    raise OpenBankingProviderError(
                        404,
                        f"Unknown persona '{persona_id}'",
                    )
                consent.raise_for_status()
                consent_id = consent.json()["Data"]["ConsentId"]
                client.post(f"/consents/{consent_id}/authorize").raise_for_status()

                accounts = client.get("/accounts", params={"consent_id": consent_id})
                accounts.raise_for_status()
                account = accounts.json()["Data"]["Account"][0]

                txns_resp = client.get(
                    f"/accounts/{_account_id(account)}/transactions",
                    params={"consent_id": consent_id},
                )
                txns_resp.raise_for_status()
                raw_txns = txns_resp.json()["Data"]["Transaction"]
                bank = _servicer_name(account)
        except OpenBankingProviderError:
            raise
        except httpx.ConnectError as exc:
            raise OpenBankingProviderError(
                503,
                f"Open Banking service unreachable at {self.base_url}.",
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise OpenBankingProviderError(
                exc.response.status_code,
                "Open Banking provider request failed.",
            ) from exc
        except (KeyError, TypeError, ValueError) as exc:
            raise OpenBankingProviderError(
                502,
                f"Invalid Open Banking provider payload: {exc}",
            ) from exc
        return bank, raw_txns
