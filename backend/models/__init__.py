import importlib.util
import os
import sys

# Load SQLAlchemy models from root backend/models.py so that both
# `import models` (with models.User, models.Student, etc.) AND
# `from models.handwriting_cnn import load_model` work simultaneously.
models_py_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models.py")
if os.path.exists(models_py_path):
    spec = importlib.util.spec_from_file_location("root_models", models_py_path)
    root_models = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(root_models)
    for k, v in root_models.__dict__.items():
        if not k.startswith("__"):
            globals()[k] = v
