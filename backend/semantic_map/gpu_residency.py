"""Serialize model handoff without changing either embedding computation path."""


class ModelGpuLock:
    def __init__(self, lock, before_enter=None):
        self.lock = lock
        self.before_enter = before_enter

    def __enter__(self):
        self.lock.acquire()
        try:
            if self.before_enter is not None:
                self.before_enter()
        except BaseException:
            self.lock.release()
            raise
        return self

    def __exit__(self, *_):
        self.lock.release()


def coordinate_reranker_residency(engine, service):
    """Reranker stays resident until an embedding operation needs the small GPU."""
    if not service.enabled or not service.keep_resident:
        return
    lock = getattr(engine, '_gpu_lock', None)
    if lock is None:
        return
    service.gpu_lock = ModelGpuLock(lock)
    engine._gpu_lock = ModelGpuLock(lock, service.offload_for_embedding)
    before_inference = service.before_inference
    def release_embedding_if_loaded():
        model = getattr(getattr(engine, '_embedder', None), 'model', None)
        if (model is not None and model.device.type == 'cuda') or getattr(engine, '_embedding_tensors', None):
            if before_inference is not None:
                before_inference()
    service.before_inference = release_embedding_if_loaded
