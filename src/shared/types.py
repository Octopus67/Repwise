"""Shared enums and types used across the platform."""

from enum import Enum


class StrEnum(str, Enum):
    """Backport of StrEnum for Python < 3.11."""
    pass


class UserRole(StrEnum):
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"


class GoalType(StrEnum):
    CUTTING = "cutting"
    MAINTAINING = "maintaining"
    BULKING = "bulking"
    RECOMPOSITION = "recomposition"


class ActivityLevel(StrEnum):
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"
    VERY_ACTIVE = "very_active"


class SubscriptionStatus(StrEnum):
    FREE = "free"
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"


class ContentStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class CoachingRequestStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class CoachingSessionStatus(StrEnum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentTransactionType(StrEnum):
    CHARGE = "charge"
    REFUND = "refund"


class PaymentTransactionStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class AuditAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class MealSourceType(StrEnum):
    CUSTOM = "custom"
    FOOD_DATABASE = "food_database"


class Sex(StrEnum):
    MALE = "male"
    FEMALE = "female"


class AuthProvider(StrEnum):
    EMAIL = "email"
    GOOGLE = "google"
    APPLE = "apple"


class TrainingPhase(StrEnum):
    ACCUMULATION = "accumulation"
    INTENSIFICATION = "intensification"
    DELOAD = "deload"
    NONE = "none"
