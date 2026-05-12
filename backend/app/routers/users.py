from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    """Verify the bearer token and return the local user row (creating it if first sight)."""
    return user
