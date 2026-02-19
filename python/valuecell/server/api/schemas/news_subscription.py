"""API schemas for personalized news subscription operations."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class NewsSubscriptionData(BaseModel):
    """User news subscription data."""

    id: str = Field(..., description="Subscription ID")
    user_id: str = Field(..., description="User ID")
    name: str = Field(..., description="Subscription display name")
    keywords: List[str] = Field(..., description="Tracked keywords")
    interval_minutes: int = Field(..., ge=5, le=1440, description="Delivery interval")
    enabled: bool = Field(..., description="Whether this subscription is enabled")
    realtime_tracking: bool = Field(
        ..., description="Whether to prioritize realtime tracking mode"
    )
    last_run_at: Optional[datetime] = Field(None, description="Last delivery timestamp")
    next_run_at: Optional[datetime] = Field(None, description="Next delivery timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")


class CreateNewsSubscriptionRequest(BaseModel):
    """Request payload for creating a news subscription."""

    name: str = Field(..., min_length=1, max_length=120)
    keywords: List[str] = Field(..., min_length=1, max_length=20)
    interval_minutes: int = Field(60, ge=5, le=1440)
    enabled: bool = True
    realtime_tracking: bool = True


class UpdateNewsSubscriptionRequest(BaseModel):
    """Request payload for updating a news subscription."""

    name: Optional[str] = Field(None, min_length=1, max_length=120)
    keywords: Optional[List[str]] = Field(None, min_length=1, max_length=20)
    interval_minutes: Optional[int] = Field(None, ge=5, le=1440)
    enabled: Optional[bool] = None
    realtime_tracking: Optional[bool] = None


class NewsSubscriptionListData(BaseModel):
    """Response payload for listing subscriptions."""

    subscriptions: List[NewsSubscriptionData] = Field(default_factory=list)
    count: int = Field(..., description="Total subscription count")


class NewsDeliveryData(BaseModel):
    """Single subscription delivery result."""

    subscription_id: str = Field(..., description="Subscription ID")
    subscription_name: str = Field(..., description="Subscription name")
    keywords: List[str] = Field(default_factory=list)
    delivered_at: datetime = Field(..., description="Delivery timestamp")
    content: str = Field(..., description="Delivered news content")


class NewsDeliveryBatchData(BaseModel):
    """Batch delivery result for due subscriptions."""

    deliveries: List[NewsDeliveryData] = Field(default_factory=list)
    delivered_count: int = Field(..., description="Number of delivered subscriptions")
