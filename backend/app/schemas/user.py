from app.schemas.common import TimestampedOut


class UserOut(TimestampedOut):
    clerk_user_id: str
    email: str
    name: str | None = None
