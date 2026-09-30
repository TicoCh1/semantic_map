"""AI verification is a separate API and SQLite store; human UI remains compatible."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Path as PathParameter
from fastapi.responses import FileResponse, Response

from .ai_verification import AIVerificationService, operation_timing, timing_phase
from .ai_verification_projection import AIProjectionService, PROFILE, YAWS
from .ai_verification_schemas import AIRatingBatch, AIRunRequest, AIAssignmentRequest, AINextRequest, AITaskBatch, AITask, AIView, AICollage
from .auth import require_backend_token
from .human_verification import HumanVerificationSampler
from .pano_service import AmbiguousPanoIdError

INSTRUCTIONS = (
    'Fetch task.image.url: one server-assembled 4-column by 2-row collage, 2048 x 1024 pixels. '
    'Inspect all eight 512 x 512 cells, left to right across the top row then the bottom row '
    '(yaw 45, 90, 135, 180, 225, 270, 315, 0 degrees). Individual views are a compatibility fallback, '
    'not additional required images. Return one unified rating for the whole panorama; '
    'never score each cell separately and average. Use rubric relatedness-inference-v2: '
    '1 = unrelated, absent, or not matching; the description has no defensible interpretation against the images. '
    '2 = slightly related or slightly present; the description is barely interpretable, including weak inferred association. '
    '3 = partially related or presence can reasonably be inferred. '
    '4 = highly related or presence can be strongly inferred. '
    '5 = the described object or feature is directly visible and unambiguously confirmed, '
    'or clear readable text explicitly identifies it. '
    'Examples: brick facade with a visible brick wall = 5; school with students and a school bus = 4; '
    'lawn with trees but a dried-out grassless lawn and trees = 3; medical centre with a small pharmacy = 2; '
    'two lane road with an eight-lane highway = 1. '
    'Evaluate the relationship actually stated by the prompt: an object visible overhead or nearby '
    'does not establish that the camera road lies on it. If the prompt does not anchor a road '
    'to the camera, state any interpretation needed in the rationale. '
    'These eight views have 45-degree FOV and pitch zero; absence outside their vertical field '
    'of view cannot be inferred. Judge each presentation independently, without consulting earlier '
    'answers, human ratings, exports, or embedding scores. Do not submit to the human ratings endpoint. '
    'All URLs are relative to the backend base URL. Persist the exact rating request body before '
    'submission; retry it unchanged after network errors.'
)


def create_ai_verification_router(settings, result_storage, human_storage, pano_registry):
    service = AIVerificationService(
        settings.result_root / 'ai_verification' / 'ratings.sqlite3', human_storage,
        HumanVerificationSampler(settings, result_storage), list(settings.default_dataset_ids))
    projection = AIProjectionService(pano_registry, settings.pano_cache_root / 'ai_verification_views')
    return build_ai_router(service, projection)


def build_ai_router(service: AIVerificationService, projection: AIProjectionService):
    router = APIRouter(prefix='/api/ai-verification', tags=['AI verification'],
                       dependencies=[Depends(require_backend_token)])

    def call(fn, *args):
        try:
            return fn(*args)
        except (AmbiguousPanoIdError, ValueError) as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from None
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from None
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from None
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from None

    @router.get('')
    def capabilities():
        return dict(schema_version=2, mode='ai_verification', create_run_url='/api/ai-verification/runs',
                    dataset_ids=list(service.default_datasets),
                    all_ratings_csv_url='/api/ai-verification/ratings.csv',
                    submission_url='/api/ai-verification/ratings', instructions=INSTRUCTIONS,
                    rubric_version='relatedness-inference-v2',
                    dispatch=dict(mode='incremental-v1',request_id_required_for_incremental=True,
                                  max_count=20,max_pending=200,legacy_pending_replay=True),
                    worker_ratings=True,
                    run_continuation=dict(mode='append-v1',default='continue',list_url='/api/ai-verification/runs',
                                          assignment_url='/api/ai-verification/assignments',quota='additional presentations including encores'),
                    presentation=dict(preferred='image',layout='4x2',width=2048,height=1024,
                                      columns=4,rows=2,cell_width=512,cell_height=512,
                                      yaw_degrees_row_major=YAWS,individual_views='compatibility_fallback'),
                    projection=dict(profile=PROFILE,yaws=YAWS,pitch=0,roll=0,fov_degrees=45,width=512,height=512),
                    priority='Human-rated exact questions first, per run; then the human sampling algorithm.',
                    encore='Hidden repeats of completed questions, gap >=10 presentations, probability 1-5%, maximum 5 per prompt per run.',
                    blind_fields='No human ratings, embedding scores, strata or encore markers in task responses.')

    @router.post('/runs')
    def create_run(payload: AIRunRequest):
        result = call(service.create_run, payload)
        if result.get('status')=='selection_required': return result
        return dict(**result, next_url=f"/api/ai-verification/runs/{result['run_id']}/next",
                    submission_url='/api/ai-verification/ratings')

    @router.get('/runs')
    def list_runs():
        return call(service.list_runs)

    @router.post('/assignments')
    def create_assignment(payload: AIAssignmentRequest):
        return call(service.create_assignment,payload)

    @router.get('/assignments/{assignment_id}/stats')
    def assignment_stats(assignment_id: str):
        return call(service.assignment_stats,assignment_id)

    @router.post('/runs/{run_id}/next', response_model=AITaskBatch)
    def next_tasks(run_id: str, payload: AINextRequest):
        rows = call(service.next_tasks, run_id, payload.count, payload.request_id, payload.assignment_id)
        tasks = []
        for row in rows:
            question = json.loads(row['payload'])
            tasks.append(AITask(task_id=row['task_id'], prompt=question['prompt'],
                image=AICollage(url=f"/api/ai-verification/runs/{run_id}/tasks/{row['task_id']}/collage.png"), views=[
                AIView(index=i,yaw_degrees=yaw,
                    url=f"/api/ai-verification/runs/{run_id}/tasks/{row['task_id']}/views/{i}.png")
                for i,yaw in enumerate(YAWS)]))
        return AITaskBatch(run_id=run_id,status='ready' if tasks else 'no_new_sample',
                           instructions=INSTRUCTIONS,tasks=tasks)

    @router.get('/runs/{run_id}/tasks/{task_id}/collage.png')
    def collage(run_id: str, task_id: str):
        task = call(service.task, run_id, task_id)
        # service.task has released the allocation lock before any image work.
        with operation_timing('collage', run_id=run_id, task_id=task_id) as timing:
            with timing_phase(timing, 'image_prepare'):
                path = call(projection.collage, json.loads(task['payload']))
        return FileResponse(path,media_type='image/png',
                            headers={'Cache-Control':'private, max-age=31536000, immutable'})

    @router.get('/runs/{run_id}/tasks/{task_id}/views/{view_index}.png')
    def view(run_id: str, task_id: str, view_index: int = PathParameter(ge=0, le=7)):
        task = call(service.task, run_id, task_id)
        with operation_timing('views', run_id=run_id, task_id=task_id) as timing:
            with timing_phase(timing, 'image_prepare'):
                paths = call(projection.views, json.loads(task['payload']))
        return FileResponse(paths[view_index],media_type='image/png',
                            headers={'Cache-Control':'private, max-age=31536000, immutable'})

    @router.post('/ratings')
    def rate(payload: AIRatingBatch):
        return call(service.record, payload)

    @router.get('/runs/{run_id}/stats')
    def stats(run_id: str):
        return call(service.stats, run_id)

    @router.get('/runs/{run_id}/ratings.csv')
    def export(run_id: str):
        return Response(call(service.export_csv, run_id),media_type='text/csv',
                            headers={'Content-Disposition':'attachment; filename="ai-verification-ratings.csv"'})

    @router.get('/ratings.csv')
    def export_all():
        return Response(call(service.export_csv),media_type='text/csv',
                        headers={'Content-Disposition':'attachment; filename="ai-verification-all-ratings.csv"',
                                 'Cache-Control':'no-store'})

    return router
