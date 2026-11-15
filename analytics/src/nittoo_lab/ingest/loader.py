from __future__ import annotations

import hashlib
import json
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import duckdb
from pydantic import ValidationError

from nittoo_lab.contracts.models import NittooExportBackup

ANALYTICS_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DB_PATH = ANALYTICS_ROOT / "data" / "nittoo.duckdb"
DEFAULT_EXPORTS_DIR = ANALYTICS_ROOT / "data" / "raw" / "exports"

OUTLIER_MAX_DAYS = 1000


@dataclass(frozen=True)
class IngestStats:
    files_processed: int
    files_failed_schema: int
    products_loaded: int
    purchases_loaded: int
    usage_periods_loaded: int
    restock_plans_loaded: int
    rejects_by_reason: dict[str, int]
    elapsed_seconds: float
    db_path: Path


def _ensure_schema(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("CREATE SCHEMA IF NOT EXISTS raw")
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.products (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            brand VARCHAR NOT NULL,
            category VARCHAR NOT NULL,
            size DOUBLE,
            unit VARCHAR,
            created_at TIMESTAMPTZ NOT NULL,
            source_file VARCHAR NOT NULL
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.purchases (
            raw_row_id VARCHAR PRIMARY KEY,
            id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            product_id VARCHAR NOT NULL,
            product_name VARCHAR NOT NULL,
            brand VARCHAR NOT NULL,
            category VARCHAR NOT NULL,
            purchase_date DATE NOT NULL,
            price DOUBLE NOT NULL,
            currency VARCHAR NOT NULL,
            store_vendor VARCHAR,
            source_file VARCHAR NOT NULL
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.usage_periods (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            product_id VARCHAR NOT NULL,
            product_name VARCHAR NOT NULL,
            purchase_id VARCHAR NOT NULL,
            opened_date DATE NOT NULL,
            finished_date DATE,
            status VARCHAR NOT NULL,
            days_used INTEGER NOT NULL,
            purchase_price DOUBLE NOT NULL,
            currency VARCHAR NOT NULL,
            cost_per_day DOUBLE,
            source_file VARCHAR NOT NULL
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.restock_plans (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            product_id VARCHAR NOT NULL,
            product_name VARCHAR NOT NULL,
            usage_period_id VARCHAR NOT NULL,
            mode VARCHAR NOT NULL,
            days_before_finish INTEGER,
            reminder_date DATE NOT NULL,
            status VARCHAR NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            source_file VARCHAR NOT NULL
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.rejects (
            reject_id VARCHAR PRIMARY KEY,
            source_file VARCHAR NOT NULL,
            entity_type VARCHAR NOT NULL,
            record_id VARCHAR,
            reason_code VARCHAR NOT NULL,
            detail VARCHAR,
            payload_json VARCHAR NOT NULL,
            ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _reject_id(
    source_file: str, entity_type: str, record_id: str | None, reason_code: str, occ: int
) -> str:
    raw_key = f"{source_file}|{entity_type}|{record_id or 'none'}|{reason_code}|{occ}"
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:24]


def _bulk_insert(
    con: duckdb.DuckDBPyConnection,
    tmp_dir: Path,
    table: str,
    conflict_col: str,
    columns: list[str],
    rows: list[tuple[object, ...]],
) -> None:
    if not rows:
        return
    ndjson_path = tmp_dir / f"{table.replace('.', '_')}.ndjson"
    with ndjson_path.open("w", encoding="utf-8") as f:
        for row in rows:
            obj = dict(zip(columns, row, strict=True))
            f.write(json.dumps(obj, default=str) + "\n")
    col_list = ", ".join(columns)
    con.execute(
        f"""
        INSERT INTO {table} ({col_list})
        SELECT {col_list} FROM read_json(?, format='newline_delimited')
        ON CONFLICT ({conflict_col}) DO NOTHING
        """,
        [str(ndjson_path)],
    )


def ingest_exports(
    exports_dir: Path = DEFAULT_EXPORTS_DIR,
    db_path: Path = DEFAULT_DB_PATH,
) -> IngestStats:
    t0 = time.perf_counter()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(exports_dir.glob("*.json"))

    products_rows: list[tuple[object, ...]] = []
    purchases_rows: list[tuple[object, ...]] = []
    usage_rows: list[tuple[object, ...]] = []
    restock_rows: list[tuple[object, ...]] = []
    reject_rows: list[tuple[object, ...]] = []
    reject_counts: dict[str, int] = {}
    files_failed = 0

    def add_reject(
        source_file: str,
        entity_type: str,
        record_id: str | None,
        reason_code: str,
        detail: str,
        payload: object,
        occ: int = 1,
    ) -> None:
        rid = _reject_id(source_file, entity_type, record_id, reason_code, occ)
        reject_rows.append(
            (
                rid,
                source_file,
                entity_type,
                record_id,
                reason_code,
                detail,
                json.dumps(payload, default=str),
            )
        )
        reject_counts[reason_code] = reject_counts.get(reason_code, 0) + 1

    for file_path in files:
        fname = file_path.name
        try:
            raw_obj = json.loads(file_path.read_text(encoding="utf-8"))
            backup = NittooExportBackup.model_validate(raw_obj)
        except (json.JSONDecodeError, ValidationError) as exc:
            files_failed += 1
            add_reject(
                fname, "file", fname, "INVALID_EXPORT_SCHEMA", str(exc)[:300], {"file": fname}
            )
            continue

        uid = backup.user.id
        product_ids_in_file = {p.id for p in backup.products}
        purchase_ids_in_file = {pu.id for pu in backup.purchases}

        for p in backup.products:
            products_rows.append(
                (p.id, uid, p.name, p.brand, p.category, p.size, p.unit, p.created_at, fname)
            )

        for idx_p, pu in enumerate(backup.purchases):
            if pu.product_id not in product_ids_in_file:
                add_reject(
                    fname,
                    "purchase",
                    pu.id,
                    "MISSING_PRODUCT_REF",
                    f"Purchase {pu.id} references unknown product_id {pu.product_id}",
                    pu.model_dump(mode="json"),
                )
                continue
            raw_row_id = hashlib.sha256(f"{fname}|{idx_p}|{pu.id}".encode()).hexdigest()[:24]
            purchases_rows.append(
                (
                    raw_row_id,
                    pu.id,
                    uid,
                    pu.product_id,
                    pu.product_name,
                    pu.brand,
                    pu.category,
                    pu.purchase_date,
                    pu.price,
                    pu.currency,
                    pu.store_vendor,
                    fname,
                )
            )

        for u in backup.usage_periods:
            reason: str | None = None
            detail = ""
            if u.product_id not in product_ids_in_file:
                reason = "MISSING_PRODUCT_REF"
                detail = f"Usage period {u.id} references unknown product_id {u.product_id}"
            elif u.purchase_id not in purchase_ids_in_file:
                reason = "MISSING_PURCHASE_REF"
                detail = f"Usage period {u.id} references unknown purchase_id {u.purchase_id}"
            elif u.finished_date is not None and u.finished_date < u.opened_date:
                reason = "FINISHED_BEFORE_OPENED"
                detail = f"finished_date {u.finished_date} < opened_date {u.opened_date}"

            if reason is not None:
                add_reject(
                    fname,
                    "usage_period",
                    u.id,
                    reason,
                    detail,
                    u.model_dump(mode="json"),
                )
                continue

            usage_rows.append(
                (
                    u.id,
                    uid,
                    u.product_id,
                    u.product_name,
                    u.purchase_id,
                    u.opened_date,
                    u.finished_date,
                    u.status,
                    u.days_used,
                    u.purchase_price,
                    u.currency,
                    u.cost_per_day,
                    fname,
                )
            )

        for rp in backup.restock_plans:
            restock_rows.append(
                (
                    rp.id,
                    uid,
                    rp.product_id,
                    rp.product_name,
                    rp.usage_period_id,
                    rp.mode,
                    rp.days_before_finish,
                    rp.reminder_date,
                    rp.status,
                    rp.created_at,
                    fname,
                )
            )

    con = duckdb.connect(str(db_path))
    try:
        _ensure_schema(con)
        with tempfile.TemporaryDirectory() as tmp_str:
            tmp_dir = Path(tmp_str)
            _bulk_insert(
                con,
                tmp_dir,
                "raw.products",
                "id",
                [
                    "id",
                    "user_id",
                    "name",
                    "brand",
                    "category",
                    "size",
                    "unit",
                    "created_at",
                    "source_file",
                ],
                products_rows,
            )
            _bulk_insert(
                con,
                tmp_dir,
                "raw.purchases",
                "raw_row_id",
                [
                    "raw_row_id",
                    "id",
                    "user_id",
                    "product_id",
                    "product_name",
                    "brand",
                    "category",
                    "purchase_date",
                    "price",
                    "currency",
                    "store_vendor",
                    "source_file",
                ],
                purchases_rows,
            )
            _bulk_insert(
                con,
                tmp_dir,
                "raw.usage_periods",
                "id",
                [
                    "id",
                    "user_id",
                    "product_id",
                    "product_name",
                    "purchase_id",
                    "opened_date",
                    "finished_date",
                    "status",
                    "days_used",
                    "purchase_price",
                    "currency",
                    "cost_per_day",
                    "source_file",
                ],
                usage_rows,
            )
            _bulk_insert(
                con,
                tmp_dir,
                "raw.restock_plans",
                "id",
                [
                    "id",
                    "user_id",
                    "product_id",
                    "product_name",
                    "usage_period_id",
                    "mode",
                    "days_before_finish",
                    "reminder_date",
                    "status",
                    "created_at",
                    "source_file",
                ],
                restock_rows,
            )
            _bulk_insert(
                con,
                tmp_dir,
                "raw.rejects",
                "reject_id",
                [
                    "reject_id",
                    "source_file",
                    "entity_type",
                    "record_id",
                    "reason_code",
                    "detail",
                    "payload_json",
                ],
                reject_rows,
            )

        counts = {
            "products": con.execute("SELECT COUNT(*) FROM raw.products").fetchone()[0],
            "purchases": con.execute("SELECT COUNT(*) FROM raw.purchases").fetchone()[0],
            "usage_periods": con.execute("SELECT COUNT(*) FROM raw.usage_periods").fetchone()[0],
            "restock_plans": con.execute("SELECT COUNT(*) FROM raw.restock_plans").fetchone()[0],
        }
    finally:
        con.close()

    elapsed = round(time.perf_counter() - t0, 3)
    return IngestStats(
        files_processed=len(files),
        files_failed_schema=files_failed,
        products_loaded=counts["products"],
        purchases_loaded=counts["purchases"],
        usage_periods_loaded=counts["usage_periods"],
        restock_plans_loaded=counts["restock_plans"],
        rejects_by_reason=reject_counts,
        elapsed_seconds=elapsed,
        db_path=db_path,
    )
