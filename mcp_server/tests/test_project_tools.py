"""Tests for project meta-tools: overview, workflows, doc search, config
inspection (no secret leakage), and the health-check allowlist."""
import json

import pytest

from mcp_server import project_tools


# --- project_overview / list_project_workflows ------------------------------

def test_project_overview_reports_live_counts():
    overview = project_tools.project_overview()
    assert overview["counts"]["offers_in_catalog"] >= 1
    assert overview["counts"]["seeded_personas"] == 3
    assert overview["counts"]["api_routes"] >= 10
    assert "core/" in overview["layers"]
    json.dumps(overview)


def test_workflows_detect_demo_spine_route():
    workflows = project_tools.list_project_workflows()
    assert "POST /journey/connect" in workflows["api_routes"]
    assert any("transactions" in r for r in workflows["mock_open_banking_routes"])
    assert "lint" in workflows["frontend_scripts"]
    assert "backend" in workflows["ci_jobs"]


# --- search_project_docs -----------------------------------------------------

def test_search_finds_sama_rules_in_readme():
    result = project_tools.search_project_docs("Responsible Lending")
    assert result["result_count"] >= 1
    assert any(hit["file"] == "README.md" for hit in result["results"])


def test_search_respects_max_results():
    result = project_tools.search_project_docs("the", max_results=3)
    assert result["result_count"] <= 3


@pytest.mark.parametrize("query", ["a", "x" * 300])
def test_search_rejects_bad_query_lengths(query):
    with pytest.raises(ValueError):
        project_tools.search_project_docs(query)


def test_search_rejects_bad_max_results():
    with pytest.raises(ValueError):
        project_tools.search_project_docs("salary", max_results=0)


# --- inspect_config: names yes, values never --------------------------------

def test_inspect_config_lists_expected_keys():
    report = project_tools.inspect_config()
    keys = {v["key"] for v in report["variables"]}
    assert "ANTHROPIC_API_KEY" in keys
    assert "DATABASE_URL" in keys


def test_inspect_config_never_leaks_values(monkeypatch):
    planted = "sk-super-secret-value-12345"
    monkeypatch.setenv("ANTHROPIC_API_KEY", planted)
    serialized = json.dumps(project_tools.inspect_config())
    assert planted not in serialized
    entry = next(
        v for v in project_tools.inspect_config()["variables"]
        if v["key"] == "ANTHROPIC_API_KEY"
    )
    assert entry["set_in_process_env"] is True  # reported as a boolean only


# --- project_health_check: allowlist enforcement -----------------------------

def test_health_check_rejects_unknown_check():
    with pytest.raises(ValueError, match="check must be one of"):
        project_tools.project_health_check("rm -rf /")


def test_allowlist_entries_are_fixed_argv():
    for name, spec in project_tools.ALLOWED_CHECKS.items():
        assert isinstance(spec.args, tuple), name
        assert spec.program in {"python", "npm"}, name
        assert spec.timeout_seconds <= 600, name


def test_health_check_executes_python_version_smoke_check():
    result = project_tools.project_health_check("python-version")
    assert result["ok"] is True
    assert "Python" in result["output_tail"]
    assert result["returncode"] == 0
