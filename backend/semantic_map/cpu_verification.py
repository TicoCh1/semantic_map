"""Verification over the same aligned 8B score catalog used by the CPU map."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from .ai_verification import AIVerificationService
from .ai_verification_api import build_ai_router
from .ai_verification_projection import AIProjectionService
from .auth import require_backend_token
from .human_verification import CompletedPrompt, CompletedResultRef, HumanVerificationSampler
from .human_verification_schemas import (
    HumanVerificationRatingBatch, HumanVerificationRatingIngestResponse,
    HumanVerificationSampleRequest, HumanVerificationStats, HumanVerificationStudy,
)
from .human_verification_storage import HumanVerificationStorage


class CatalogVerificationSampler(HumanVerificationSampler):
    def __init__(self, settings, get_catalog, *, prompt_completion_counts=None):
        super().__init__(settings, None, prompt_completion_counts=prompt_completion_counts)
        self.get_catalog = get_catalog

    def _completed_prompts(self, requested_dataset_ids):
        catalog = self.get_catalog()
        if not set(requested_dataset_ids).issubset(catalog.datasets):
            raise ValueError('Verification requires the active saved-score datasets')
        return tuple(
            CompletedPrompt(prompt, tuple(
                CompletedResultRef(dataset, f"saved-{catalog.datasets[dataset]['lookup'][prompt]}",
                                   None, catalog.datasets[dataset]['revision'])
                for dataset in requested_dataset_ids
            ))
            for prompt, datasets in sorted(catalog.prompts.items())
            if set(requested_dataset_ids).issubset(datasets)
        )

    def _result_data(self, entry):
        catalog = self.get_catalog()
        data, _ = catalog.resolve(entry.dataset_id, entry.prompt_id)
        if entry.result_revision != data['revision']:
            raise ValueError('Saved scores changed; request a new verification study')
        scores, zscores = catalog.arrays(entry.dataset_id, entry.prompt_id)
        return self.settings.default_dataset_group_id, scores, zscores, data['records']


def create_cpu_verification_router(settings, get_catalog, pano_registry):
    # Keep durable ratings in their original root, never in the CPU tile cache.
    human = HumanVerificationStorage(settings.result_root / 'human_verification' / 'ratings.sqlite3')
    sampler = CatalogVerificationSampler(settings, get_catalog, prompt_completion_counts=lambda:
        human.prompt_completion_counts({d: v['revision'] for d, v in get_catalog().datasets.items()}))
    # AI owns its balancing callback; it must not mutate the human sampler.
    ai = AIVerificationService(settings.result_root / 'ai_verification' / 'ratings.sqlite3',
        human, CatalogVerificationSampler(settings, get_catalog), list(settings.default_dataset_ids))
    projection = AIProjectionService(pano_registry, settings.pano_cache_root / 'ai_verification_views')
    router = APIRouter()
    router.include_router(build_ai_router(ai, projection))

    @router.get('/api/verification')
    def source():
        catalog = get_catalog()
        return dict(mode='verification', dataset_ids=list(catalog.datasets),
                    model_version='8B', embedding_dimensions=4096,
                    scoring_version='saved-city-only-4096', normalization='per-city z-score',
                    prompt_count=len(catalog.prompts),
                    result_revisions={d: v['revision'] for d, v in catalog.datasets.items()},
                    sample_url='/api/verification/sample', ai_verification_url='/api/ai-verification')

    @router.post('/api/verification/sample', response_model=HumanVerificationStudy)
    def sample(payload: HumanVerificationSampleRequest):
        try:
            study = sampler.sample(payload)
            human.register_study(study)
            return study
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None
        except FileNotFoundError as exc:
            raise HTTPException(409, str(exc)) from None
        except (ValueError, RuntimeError) as exc:
            raise HTTPException(400, str(exc)) from None

    @router.post('/api/verification/ratings', response_model=HumanVerificationRatingIngestResponse)
    def rate(payload: HumanVerificationRatingBatch, request: Request):
        try:
            address = next((request.headers[h].split(',')[0].strip()[:128]
                for h in ('cf-connecting-ip', 'x-forwarded-for', 'x-real-ip')
                if request.headers.get(h, '').strip()), None)
            return human.record_ratings(payload,
                client_ip=address or (request.client.host[:128] if request.client else None),
                user_agent=request.headers.get('user-agent', '')[:512] or None)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None

    @router.get('/api/verification/stats', response_model=HumanVerificationStats,
                dependencies=[Depends(require_backend_token)])
    def stats():
        return human.stats()

    @router.get('/api/verification/ratings.csv', dependencies=[Depends(require_backend_token)])
    def export():
        return Response(content=human.export_csv(), media_type='text/csv; charset=utf-8',
            headers={'Content-Disposition': 'attachment; filename="human-verification-ratings.csv"'})

    return router
