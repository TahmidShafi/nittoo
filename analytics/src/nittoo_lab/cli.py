import typer

app = typer.Typer(help="Nittoo Forecast Lab CLI")


@app.command()
def version() -> None:
    """Print lab version."""
    typer.echo("0.1.0")
