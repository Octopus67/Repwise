---
inclusion: manual
---

# API Reference

All endpoints prefixed with `/api/v1/`. Auth via `Authorization: Bearer <jwt_token>`.

## Auth (`/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Create account (email, password, name) |
| POST | `/login` | No | Get access + refresh tokens |
| POST | `/refresh` | No | Refresh access token |
| POST | `/logout` | Yes | Invalidate tokens |
| GET | `/me` | Yes | Get current user (id, email, role) |
| POST | `/forgot-password` | No | Send password reset email |
| POST | `/reset-password` | No | Reset password with token |

## Users (`/users`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile` | Yes | Get user profile |
| PUT | `/profile` | Yes | Update profile |
| POST | `/metrics` | Yes | Log body metrics |
| GET | `/metrics/history` | Yes | Get metrics history |
| POST | `/bodyweight` | Yes | Log bodyweight |
| GET | `/bodyweight/history` | Yes | Get bodyweight history |
| PUT | `/goals` | Yes | Set goals (cut/bulk/maintain) |
| GET | `/goals` | Yes | Get current goals |
| POST | `/recalculate` | Yes | Recalculate targets |

## Nutrition (`/nutrition`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/entries` | Yes | Create nutrition entry (meal_name, food_name, calories, macros, micros) |
| GET | `/entries` | Yes | List entries (start_date, end_date, page, limit) |
| PUT | `/entries/{id}` | Yes | Update entry |
| DELETE | `/entries/{id}` | Yes | Soft-delete entry |
| POST | `/entries/batch` | Yes | Create multiple entries as meal |
| POST | `/entries/copy` | Yes | Copy entries from one date to another |
| GET | `/micronutrient-dashboard` | Yes | Weekly micro aggregation with score and deficiency alerts |

## Training (`/training`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/exercises` | Yes | List all exercises (1200+) |
| GET | `/exercises/search` | Yes | Search by name/muscle/equipment |
| POST | `/sessions` | Yes | Create training session |
| GET | `/sessions` | Yes | List sessions |
| GET | `/sessions/{id}` | Yes | Get session detail |
| PUT | `/sessions/{id}` | Yes | Update session |
| DELETE | `/sessions/{id}` | Yes | Delete session |
| GET | `/analytics/muscle-volume` | Yes | Weekly volume (WNS or legacy via feature flag) |
| GET | `/analytics/muscle-volume/{mg}/detail` | Yes | Per-exercise volume breakdown |
| GET | `/analytics/volume-trend` | Yes | Daily volume trend |
| GET | `/analytics/volume-landmarks` | Yes | MEV/MAV/MRV landmarks |
| PUT | `/analytics/volume-landmarks` | Yes | Set custom landmarks |

## Food (`/food`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/search` | Yes | Full-text food search (q, limit) |
| GET | `/barcode/{code}` | Yes | Barcode lookup (cache → OFF → USDA) |

## Adaptive (`/adaptive`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/daily-targets` | Yes | Get adaptive daily macro targets |

## Content (`/content`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/articles` | Yes | List articles (paginated, filterable) |
| GET | `/articles/{id}` | Yes | Get article detail (premium-gated) |

## Dietary Analysis (`/dietary`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trends` | Yes | Dietary trend analysis (window_days) |
| GET | `/gaps` | Premium | Identify nutritional gaps |
| GET | `/recommendations` | Premium | Food recommendations for gaps |

## Social (`/social`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/follow/{user_id}` | Yes | Follow a user |
| DELETE | `/follow/{user_id}` | Yes | Unfollow a user |
| GET | `/followers` | Yes | Paginated followers list |
| GET | `/following` | Yes | Paginated following list |
| GET | `/feed?cursor_time=&cursor_id=&limit=20` | Yes | Activity feed (fan-out-on-read) |
| POST | `/feed/{event_id}/reactions` | Yes | Add reaction (body: `{emoji}`) |
| DELETE | `/feed/{event_id}/reactions` | Yes | Remove reaction |
| GET | `/leaderboard/{board_type}?period_start=` | Yes | board_type: weekly_volume\|streak\|exercise_1rm |
| POST | `/templates/{template_id}/share` | Yes | Create share link |
| GET | `/shared/{share_code}` | **No** | Preview shared template (PUBLIC) |
| POST | `/shared/{share_code}/copy` | Yes | Copy template to user's collection |

## Payments (`/payments`) — RevenueCat Only
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhook/revenuecat` | Bearer token | RevenueCat webhook (server-to-server) |
| POST | `/cancel` | Yes | Cancel subscription |
| GET | `/status` | Yes | Get subscription status |

> Removed: `/subscribe`, `/webhook/{provider}`, `/refund`, `/winback-offer` (RevenueCat handles natively)

## Health: `GET /health/` → `{"status": "ok"}` (no auth)

## Response Formats
- **Success:** `{ field1, field2 }` or `{ items: [...], total_count, page, limit }`
- **Error:** `{ status, code, message, details }`

## Key Query Params
`week_start` (Monday date) · `start_date`/`end_date` · `page`/`limit` (max 500) · `q` (food search) · `cursor_time`/`cursor_id` (feed pagination)
