"""CORE's official tokenizer/model behind the existing CUDA embedding contract.

This adapter produces independent image/text embeddings. It never computes
cosine scores, calls a reranker, or changes the serving model.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys

MODEL_ID = 'Alibaba-NLP/core-emb-8b'
DOCUMENT_INSTRUCTION = "Represent the user's input."
PROFILE = 'core-official-i2t-is-query-false-eod-last-valid-v1'


def official_classes(repo_dir):
    path = Path(repo_dir).resolve() / 'models/qwen3_vl/qwen3_vl_wrapper.py'
    name = 'urbanfabric_core_official_wrapper'
    existing = sys.modules.get(name)
    if existing is not None:
        if Path(existing.__file__).resolve() != path:
            raise RuntimeError('Two different CORE source checkouts in one process')
        return existing.Qwen3VLForEmbedding, existing.Qwen3VLForEmbeddingProcessor
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    return module.Qwen3VLForEmbedding, module.Qwen3VLForEmbeddingProcessor


def provenance(repo_dir, model_dir):
    """Size/mtime and pinned revision identity, without hashing payload files."""
    repo, model = Path(repo_dir).resolve(), Path(model_dir).resolve()
    wrapper = repo / 'models/qwen3_vl/qwen3_vl_wrapper.py'
    download = json.loads((model / 'urbanfabric-download.json').read_text())
    if download.get('model_id') != MODEL_ID or download.get('status') != 'complete':
        raise RuntimeError('Download the official CORE checkpoint with download_core_model.py first')
    for item in download['files']:
        path = model / item['name']
        if not path.is_file() or path.stat().st_size != item['size']:
            raise RuntimeError(f'Incomplete CORE checkpoint: {path}')
    return {'model_id': MODEL_ID, 'revision': download['revision'], 'profile': PROFILE,
            'source_revision': subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip(),
            'official_wrapper': {'path': str(wrapper), 'size': wrapper.stat().st_size,
                                 'mtime_ns': wrapper.stat().st_mtime_ns},
            'adapter': {'path': str(Path(__file__).resolve()), 'size': Path(__file__).stat().st_size,
                        'mtime_ns': Path(__file__).stat().st_mtime_ns},
            'pooling': 'last_nonpadding_token_including_official_eod', 'normalization': 'L2',
            'document_instruction': DOCUMENT_INSTRUCTION, 'text_is_query': False}


class CudaProcessorBridge:
    """Use CORE's EOD tokenizer with Transformers' direct CUDA pixel route.

    CORE's high-level processor accepts PIL/file paths. The optimized shared
    engine already builds the identical image-only conversation, so dispatch
    its rendered text and GPU tensors to the base processor directly. Keep the
    original processor available for reference/PIL and text inference.
    """
    def __init__(self, official):
        self.official = official

    def __getattr__(self, name):
        return getattr(self.official, name)

    def __call__(self, **kwargs):
        from transformers import Qwen3VLProcessor
        return Qwen3VLProcessor.__call__(self.official, **kwargs)


class CoreEmbedder:
    def __init__(self, model_name_or_path='/workspace/models/core-emb-8b',
                 repo_dir='/workspace/core-emb', dtype=None, max_length=3024):
        import torch
        if not torch.cuda.is_available():
            raise RuntimeError('CORE inference requires CUDA; model weights were not loaded')
        self.provenance = provenance(repo_dir, model_name_or_path)
        model_class, processor_class = official_classes(repo_dir)
        dtype = dtype or torch.bfloat16
        self.model = model_class.from_pretrained(model_name_or_path, device_map='cuda',
            torch_dtype=dtype, attn_implementation='sdpa').eval()
        if self.model.config.text_config.hidden_size != 4096:
            raise RuntimeError('This pipeline requires the official 4096-dimensional CORE 8B checkpoint')
        self.model.config.use_cache = False
        self.model.config.text_config.use_cache = False
        self.default_instruction = DOCUMENT_INSTRUCTION
        self.min_pixels, self.max_pixels = 4096, 512 * 512
        self.max_length = max_length
        self.official_processor = processor_class.from_pretrained(model_name_or_path,
            use_fast=True, instruction_standalone=True, padding_side='right',
            min_pixels=self.min_pixels, max_pixels=self.max_pixels, max_length=max_length)
        self.processor = CudaProcessorBridge(self.official_processor)
        self.torch = torch

    def forward(self, data):
        result = self.model(**data, use_cache=False)
        return {'last_hidden_state': result.last_hidden_state, 'attention_mask': data['attention_mask']}

    @staticmethod
    def _pooling_last(hidden, mask):
        import torch
        positions = torch.arange(mask.shape[1], device=mask.device).expand_as(mask)
        indices = positions.masked_fill(mask == 0, -1).max(dim=1).values
        if (indices < 0).any():
            raise ValueError('Cannot pool an empty sequence')
        return hidden[torch.arange(len(hidden), device=hidden.device), indices]

    def reference_inputs(self, items):
        """Match official embedding.py i2t_emb(..., is_query=False) for both sides."""
        if not items:
            raise ValueError('Empty CORE batch')
        if any(bool(item.get('image') is not None) == bool(item.get('text') is not None) for item in items):
            raise ValueError('Each CORE item must have exactly one image or one text')
        return self.official_processor(texts=[item.get('text') for item in items],
            images=[item.get('image') for item in items], videos=[None] * len(items),
            instruction=[None] * len(items), is_query=False, max_length=self.max_length,
            truncation=True, padding=True)

    def process(self, items, normalize=True):
        torch = self.torch
        with torch.inference_mode():
            data = self.reference_inputs(items).to(self.model.device)
            result = self.forward(data)
            values = self._pooling_last(result['last_hidden_state'], result['attention_mask'])
            return torch.nn.functional.normalize(values, p=2, dim=-1) if normalize else values
