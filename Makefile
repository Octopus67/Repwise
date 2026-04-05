# Audit fix 10.22 — Dependency pinning
# Run: pip-compile pyproject.toml -o requirements.lock

.PHONY: lock
lock:
	pip-compile pyproject.toml -o requirements.lock

.PHONY: install-locked
install-locked:
	pip install -r requirements.lock
