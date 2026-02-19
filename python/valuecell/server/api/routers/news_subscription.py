"""News subscription API routes for scheduled personalized delivery."""

from fastapi import APIRouter, HTTPException, Path

from ...services.news_subscription_service import (
    DEFAULT_USER_ID,
    get_news_subscription_service,
)
from ..schemas.base import SuccessResponse
from ..schemas.news_subscription import (
    CreateNewsSubscriptionRequest,
    NewsDeliveryBatchData,
    NewsDeliveryData,
    NewsSubscriptionData,
    NewsSubscriptionListData,
    UpdateNewsSubscriptionRequest,
)


def create_news_subscription_router() -> APIRouter:
    """Create router for personalized news subscription APIs."""
    router = APIRouter(prefix="/news/subscriptions", tags=["News Subscriptions"])
    service = get_news_subscription_service()

    @router.get("", response_model=SuccessResponse[NewsSubscriptionListData])
    async def list_subscriptions():
        rows = service.list_subscriptions(DEFAULT_USER_ID)
        items = [NewsSubscriptionData(**row) for row in rows]
        return SuccessResponse.create(
            data=NewsSubscriptionListData(subscriptions=items, count=len(items)),
            msg="News subscriptions retrieved successfully",
        )

    @router.post("", response_model=SuccessResponse[NewsSubscriptionData])
    async def create_subscription(request: CreateNewsSubscriptionRequest):
        try:
            row = service.create_subscription(
                name=request.name,
                keywords=request.keywords,
                interval_minutes=request.interval_minutes,
                enabled=request.enabled,
                realtime_tracking=request.realtime_tracking,
                user_id=DEFAULT_USER_ID,
            )
            return SuccessResponse.create(
                data=NewsSubscriptionData(**row),
                msg="News subscription created successfully",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @router.put(
        "/{subscription_id}", response_model=SuccessResponse[NewsSubscriptionData]
    )
    async def update_subscription(
        subscription_id: str = Path(..., description="Subscription ID"),
        request: UpdateNewsSubscriptionRequest = ...,
    ):
        try:
            row = service.update_subscription(
                subscription_id=subscription_id,
                name=request.name,
                keywords=request.keywords,
                interval_minutes=request.interval_minutes,
                enabled=request.enabled,
                realtime_tracking=request.realtime_tracking,
                user_id=DEFAULT_USER_ID,
            )
            if row is None:
                raise HTTPException(status_code=404, detail="Subscription not found")
            return SuccessResponse.create(
                data=NewsSubscriptionData(**row),
                msg="News subscription updated successfully",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @router.delete("/{subscription_id}", response_model=SuccessResponse[dict])
    async def delete_subscription(
        subscription_id: str = Path(..., description="Subscription ID"),
    ):
        deleted = service.delete_subscription(
            subscription_id=subscription_id,
            user_id=DEFAULT_USER_ID,
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="Subscription not found")
        return SuccessResponse.create(
            data={"subscription_id": subscription_id, "deleted": True},
            msg="News subscription deleted successfully",
        )

    @router.post(
        "/{subscription_id}/deliver",
        response_model=SuccessResponse[NewsDeliveryData],
    )
    async def deliver_subscription(
        subscription_id: str = Path(..., description="Subscription ID"),
    ):
        delivery = await service.deliver_subscription(
            subscription_id=subscription_id,
            user_id=DEFAULT_USER_ID,
        )
        if delivery is None:
            raise HTTPException(status_code=404, detail="Subscription not found")

        return SuccessResponse.create(
            data=NewsDeliveryData(**delivery),
            msg="News delivered successfully",
        )

    @router.post("/deliver-due", response_model=SuccessResponse[NewsDeliveryBatchData])
    async def deliver_due_subscriptions():
        deliveries = await service.deliver_due_subscriptions(user_id=DEFAULT_USER_ID)
        result = NewsDeliveryBatchData(
            deliveries=[NewsDeliveryData(**item) for item in deliveries],
            delivered_count=len(deliveries),
        )
        return SuccessResponse.create(
            data=result,
            msg="Due news delivery completed",
        )

    return router
