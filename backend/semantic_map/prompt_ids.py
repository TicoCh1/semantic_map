from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime, timezone


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_prompt(prompt: str) -> str:
    text = unicodedata.normalize("NFKC", prompt)
    text = text.casefold()
    text = re.sub(r"[\u200b-\u200f\ufeff]", "", text)
    text = re.sub(r"[\u2018\u2019\u201a\u201b]", "'", text)
    text = re.sub(r"[\u201c\u201d\u201e\u201f]", '"', text)
    text = re.sub(r"[\u2010-\u2015]", "-", text)
    text = re.sub(r"(?<=\w)[_/\\-]+(?=\w)", " ", text)
    text = re.sub(r"[\"'`]+", "", text)
    text = re.sub(r"\s*[,.;:!?]+\s*", " ", text)
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = text.replace("_", " ")
    return re.sub(r"\s+", " ", text.strip())


def normalize_prompt_legacy(prompt: str) -> str:
    return re.sub(r"\s+", " ", prompt.strip())


def prompt_slug(prompt: str, *, max_length: int = 72) -> str:
    normalized = unicodedata.normalize("NFKD", normalize_prompt(prompt))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    if not slug:
        slug = "prompt"
    return slug[:max_length].strip("-") or "prompt"


def make_prompt_key_hash(
    dataset_id: str,
    prompt: str,
    model_version: str,
    scoring_version: str,
    tile_index_version: str | None = None,
) -> str:
    return prompt_key_hash_from_normalized(
        dataset_id=dataset_id,
        normalized_prompt=normalize_prompt(prompt),
        model_version=model_version,
        scoring_version=scoring_version,
        tile_index_version=tile_index_version,
    )


def make_reference_prompt_key_hash(
    *,
    dataset_id: str,
    reference_dataset_id: str,
    reference_pano_id: str,
    reference_pano_dataset_id: str | None = None,
    model_version: str,
    scoring_version: str,
    tile_index_version: str | None = None,
) -> str:
    raw = "\n".join(
        [
            "pano_reference",
            dataset_id,
            reference_dataset_id,
            reference_pano_dataset_id or reference_dataset_id,
            str(reference_pano_id),
            model_version,
            scoring_version,
            tile_index_version or "",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def prompt_key_hash_from_normalized(
    *,
    dataset_id: str,
    normalized_prompt: str,
    model_version: str,
    scoring_version: str,
    tile_index_version: str | None = None,
) -> str:
    raw = "\n".join(
        [
            dataset_id,
            normalized_prompt,
            model_version,
            scoring_version,
            tile_index_version or "",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def make_prompt_id(
    dataset_id: str,
    prompt: str,
    model_version: str,
    scoring_version: str,
    tile_index_version: str | None = None,
) -> str:
    normalized = normalize_prompt(prompt)
    digest = make_prompt_key_hash(dataset_id, normalized, model_version, scoring_version, tile_index_version)
    return f"{prompt_slug(normalized)}--{digest[:12]}"


def make_reference_prompt_id(
    *,
    dataset_id: str,
    reference_dataset_id: str,
    reference_pano_id: str,
    reference_pano_dataset_id: str | None = None,
    model_version: str,
    scoring_version: str,
    tile_index_version: str | None = None,
) -> str:
    digest = make_reference_prompt_key_hash(
        dataset_id=dataset_id,
        reference_dataset_id=reference_dataset_id,
        reference_pano_id=reference_pano_id,
        reference_pano_dataset_id=reference_pano_dataset_id,
        model_version=model_version,
        scoring_version=scoring_version,
        tile_index_version=tile_index_version,
    )
    reference_label = f"reference pano {reference_pano_dataset_id or reference_dataset_id} {reference_pano_id}"
    return f"{prompt_slug(reference_label)}--{digest[:12]}"


def make_legacy_prompt_id(
    dataset_id: str,
    prompt: str,
    model_version: str,
    scoring_version: str,
    tile_index_version: str | None = None,
) -> str:
    return prompt_key_hash_from_normalized(
        dataset_id=dataset_id,
        normalized_prompt=normalize_prompt_legacy(prompt),
        model_version=model_version,
        scoring_version=scoring_version,
        tile_index_version=tile_index_version,
    )


def make_job_id(now: str, prompt_id: str) -> str:
    compact_time = now.replace("-", "").replace(":", "").replace("T", "_").replace("Z", "")
    return f"job_{compact_time}_{prompt_id[:10]}"
