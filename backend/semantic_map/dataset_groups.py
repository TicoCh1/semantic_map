from __future__ import annotations

import hashlib

from .tile_index import safe_segment


def unique_dataset_ids(dataset_ids) -> tuple[str, ...]:
    items: list[str] = []
    for raw in dataset_ids:
        item = str(raw).strip()
        if item and item not in items:
            items.append(item)
    if not items:
        raise ValueError("At least one dataset id is required")
    return tuple(items)


def dataset_group_id_for(dataset_ids: tuple[str, ...], explicit: str | None = None) -> str:
    if explicit:
        return safe_segment(explicit)
    if len(dataset_ids) == 1:
        return safe_segment(dataset_ids[0])
    joined = "__".join(safe_segment(dataset_id) for dataset_id in dataset_ids)
    if len(joined) <= 96:
        return joined
    digest = hashlib.sha256("\n".join(dataset_ids).encode("utf-8")).hexdigest()[:12]
    return f"dataset_group_{digest}"


def scoring_version_for_dataset_group(base_scoring_version: str, dataset_ids: tuple[str, ...], dataset_group_id: str) -> str:
    if len(dataset_ids) == 1:
        return base_scoring_version
    digest = hashlib.sha256("\n".join(dataset_ids).encode("utf-8")).hexdigest()[:12]
    group = safe_segment(dataset_group_id)
    return f"{base_scoring_version}--group-{group}-{digest}"
