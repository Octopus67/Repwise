"""Import module Pydantic response schemas."""

from typing import Optional

from pydantic import BaseModel


class ExerciseMapping(BaseModel):
    imported_name: str
    matched: Optional[str] = None
    confidence: Optional[float] = None
    db_id: Optional[str] = None
    create_as_custom: bool = False


class ImportPreviewResponse(BaseModel):
    session_count: int
    date_range: tuple[str, str]
    exercise_mappings: list[ExerciseMapping]
    unmapped_count: int


class ImportResultResponse(BaseModel):
    sessions_imported: int
    exercises_created: int
    prs_detected: int


class ImportStatusResponse(BaseModel):
    status: str  # pending, processing, completed, failed
    progress: float = 0.0
    result: Optional[ImportResultResponse] = None
