from typer.testing import CliRunner

from nittoo_lab.cli import app

runner = CliRunner()


def test_cli_help_lists_all_subcommands() -> None:
    res = runner.invoke(app, ["--help"])
    assert res.exit_code == 0
    for cmd in ("simulate", "ingest", "transform", "report", "all"):
        assert cmd in res.stdout
