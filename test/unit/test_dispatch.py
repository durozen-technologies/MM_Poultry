"""Unit tests for app.services.wholesale.dispatch pure functions and models."""

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.models.enums import DeliveryRunStatus
from app.services.wholesale.dispatch import (
    DispatchItemSummary,
    DispatchOrderItemLine,
    DispatchOrderLine,
    DispatchRouteBucket,
    DispatchRunSummary,
    DispatchTodayOut,
    _aggregate_order_items,
    _derive_route_status,
    _order_item_lines,
    order_kg,
)


class TestDeriveRouteStatus:
    def test_pending_no_assignment(self):
        runs: list = []
        result = _derive_route_status(
            remaining_unassigned=Decimal("10.000"),
            assigned_kg=Decimal("0.000"),
            runs=runs,
        )
        assert result == "pending"

    def test_partial_assignment(self):
        runs: list = []
        result = _derive_route_status(
            remaining_unassigned=Decimal("10.000"),
            assigned_kg=Decimal("5.000"),
            runs=runs,
        )
        assert result == "partial_assigned"

    def test_in_progress_run(self):
        run = MagicMock()
        run.status = DeliveryRunStatus.IN_PROGRESS
        result = _derive_route_status(
            remaining_unassigned=Decimal("0.000"),
            assigned_kg=Decimal("10.000"),
            runs=[run],
        )
        assert result == "in_progress"

    def test_completed_no_runs(self):
        result = _derive_route_status(
            remaining_unassigned=Decimal("0.000"),
            assigned_kg=Decimal("10.000"),
            runs=[],
        )
        assert result == "completed"

    def test_completed_all_terminal(self):
        run1 = MagicMock()
        run1.status = DeliveryRunStatus.COMPLETED
        run2 = MagicMock()
        run2.status = DeliveryRunStatus.CANCELLED
        result = _derive_route_status(
            remaining_unassigned=Decimal("0.000"),
            assigned_kg=Decimal("10.000"),
            runs=[run1, run2],
        )
        assert result == "completed"

    def test_assigned_no_remaining(self):
        run = MagicMock()
        run.status = DeliveryRunStatus.PLANNED
        result = _derive_route_status(
            remaining_unassigned=Decimal("0.000"),
            assigned_kg=Decimal("10.000"),
            runs=[run],
        )
        assert result == "assigned"

    def test_partial_assigned_with_in_progress(self):
        run = MagicMock()
        run.status = DeliveryRunStatus.IN_PROGRESS
        result = _derive_route_status(
            remaining_unassigned=Decimal("5.000"),
            assigned_kg=Decimal("5.000"),
            runs=[run],
        )
        assert result == "partial_assigned"

    def test_pending_zero_remaining(self):
        result = _derive_route_status(
            remaining_unassigned=Decimal("0.000"),
            assigned_kg=Decimal("0.000"),
            runs=[],
        )
        assert result == "completed"


class TestOrderItemLines:
    def test_basic_order_items(self):
        item = MagicMock()
        item.name = "Live Bird"

        line = MagicMock()
        line.item_id = uuid4()
        line.item = item
        line.total_boxes = 2
        line.requested_kg = Decimal("40.000")

        order = MagicMock()
        order.items = [line]

        result = _order_item_lines(order)

        assert len(result) == 1
        assert isinstance(result[0], DispatchOrderItemLine)
        assert result[0].item_id == line.item_id
        assert result[0].item_name == "Live Bird"
        assert result[0].total_boxes == 2
        assert result[0].requested_kg == Decimal("40.000")

    def test_order_items_with_none_item(self):
        line = MagicMock()
        line.item_id = uuid4()
        line.item = None
        line.total_boxes = None
        line.requested_kg = None

        order = MagicMock()
        order.items = [line]

        result = _order_item_lines(order)

        assert len(result) == 1
        assert result[0].item_name is None
        assert result[0].total_boxes is None
        assert result[0].requested_kg is None

    def test_empty_order_items(self):
        order = MagicMock()
        order.items = []

        result = _order_item_lines(order)

        assert result == []


class TestAggregateOrderItems:
    def test_single_order_single_item(self):
        item = MagicMock()
        item.name = "Live Bird"

        line = MagicMock()
        line.item_id = uuid4()
        line.item = item
        line.total_boxes = 2
        line.requested_kg = Decimal("40.000")

        order = MagicMock()
        order.items = [line]

        result = _aggregate_order_items([order])

        assert len(result) == 1
        assert isinstance(result[0], DispatchItemSummary)
        assert result[0].item_id == line.item_id
        assert result[0].item_name == "Live Bird"
        assert result[0].total_boxes == 2
        assert result[0].total_kg == Decimal("40.000")

    def test_multiple_orders_same_item(self):
        item_id = uuid4()
        item = MagicMock()
        item.name = "Live Bird"

        line1 = MagicMock()
        line1.item_id = item_id
        line1.item = item
        line1.total_boxes = 2
        line1.requested_kg = Decimal("40.000")

        line2 = MagicMock()
        line2.item_id = item_id
        line2.item = item
        line2.total_boxes = 3
        line2.requested_kg = Decimal("60.000")

        order1 = MagicMock()
        order1.items = [line1]
        order2 = MagicMock()
        order2.items = [line2]

        result = _aggregate_order_items([order1, order2])

        assert len(result) == 1
        assert result[0].total_boxes == 5
        assert result[0].total_kg == Decimal("100.000")

    def test_multiple_different_items(self):
        item1 = MagicMock()
        item1.name = "Live Bird"
        item2 = MagicMock()
        item2.name = "Broiler"

        line1 = MagicMock()
        line1.item_id = uuid4()
        line1.item = item1
        line1.total_boxes = 2
        line1.requested_kg = Decimal("40.000")

        line2 = MagicMock()
        line2.item_id = uuid4()
        line2.item = item2
        line2.total_boxes = 1
        line2.requested_kg = Decimal("20.000")

        order = MagicMock()
        order.items = [line1, line2]

        result = _aggregate_order_items([order])

        assert len(result) == 2
        assert result[0].item_name == "Broiler"
        assert result[1].item_name == "Live Bird"

    def test_items_with_none_requested_kg(self):
        item = MagicMock()
        item.name = "Live Bird"

        line = MagicMock()
        line.item_id = uuid4()
        line.item = item
        line.total_boxes = None
        line.requested_kg = None

        order = MagicMock()
        order.items = [line]

        result = _aggregate_order_items([order])

        assert len(result) == 1
        assert result[0].total_boxes == 0
        assert result[0].total_kg == Decimal("0.000")

    def test_empty_orders(self):
        result = _aggregate_order_items([])
        assert result == []

    def test_items_sorted_by_name_then_id(self):
        item1 = MagicMock()
        item1.name = "Zebra"
        item2 = MagicMock()
        item2.name = "Apple"

        id1 = uuid4()
        id2 = uuid4()

        line1 = MagicMock()
        line1.item_id = id1
        line1.item = item1
        line1.total_boxes = 1
        line1.requested_kg = Decimal("10.000")

        line2 = MagicMock()
        line2.item_id = id2
        line2.item = item2
        line2.total_boxes = 1
        line2.requested_kg = Decimal("10.000")

        order = MagicMock()
        order.items = [line1, line2]

        result = _aggregate_order_items([order])

        assert result[0].item_name == "Apple"
        assert result[1].item_name == "Zebra"


class TestOrderKg:
    def test_basic_order_kg(self):
        line1 = MagicMock()
        line1.requested_kg = Decimal("40.000")
        line2 = MagicMock()
        line2.requested_kg = Decimal("60.000")

        order = MagicMock()
        order.items = [line1, line2]

        result = order_kg(order)
        assert result == Decimal("100.000")

    def test_order_kg_with_none_items(self):
        line1 = MagicMock()
        line1.requested_kg = None
        line2 = MagicMock()
        line2.requested_kg = Decimal("50.000")

        order = MagicMock()
        order.items = [line1, line2]

        result = order_kg(order)
        assert result == Decimal("50.000")

    def test_empty_order_kg(self):
        order = MagicMock()
        order.items = []

        result = order_kg(order)
        assert result == Decimal("0.000")

    def test_all_none_order_kg(self):
        line1 = MagicMock()
        line1.requested_kg = None
        line2 = MagicMock()
        line2.requested_kg = None

        order = MagicMock()
        order.items = [line1, line2]

        result = order_kg(order)
        assert result == Decimal("0.000")


class TestPydanticModels:
    def test_dispatch_order_item_line(self):
        item_id = uuid4()
        line = DispatchOrderItemLine(
            item_id=item_id,
            item_name="Test Item",
            total_boxes=5,
            requested_kg=Decimal("25.000"),
        )
        assert line.item_id == item_id
        assert line.item_name == "Test Item"
        assert line.total_boxes == 5
        assert line.requested_kg == Decimal("25.000")

    def test_dispatch_order_item_line_defaults(self):
        item_id = uuid4()
        line = DispatchOrderItemLine(item_id=item_id)
        assert line.item_name is None
        assert line.total_boxes is None
        assert line.requested_kg is None

    def test_dispatch_item_summary(self):
        item_id = uuid4()
        summary = DispatchItemSummary(
            item_id=item_id,
            item_name="Test Item",
            total_boxes=10,
            total_kg=Decimal("50.000"),
        )
        assert summary.item_id == item_id
        assert summary.item_name == "Test Item"
        assert summary.total_boxes == 10
        assert summary.total_kg == Decimal("50.000")

    def test_dispatch_item_summary_defaults(self):
        item_id = uuid4()
        summary = DispatchItemSummary(item_id=item_id)
        assert summary.item_name is None
        assert summary.total_boxes == 0
        assert summary.total_kg == Decimal("0")

    def test_dispatch_order_line(self):
        order_id = uuid4()
        retailer_id = uuid4()
        line = DispatchOrderLine(
            order_id=order_id,
            retailer_id=retailer_id,
            shop_name="Test Shop",
            requested_kg=Decimal("40.000"),
            dispatch_status="eligible",
            items=[],
        )
        assert line.order_id == order_id
        assert line.retailer_id == retailer_id
        assert line.shop_name == "Test Shop"
        assert line.requested_kg == Decimal("40.000")
        assert line.dispatch_status == "eligible"
        assert line.items == []

    def test_dispatch_order_line_defaults(self):
        order_id = uuid4()
        retailer_id = uuid4()
        line = DispatchOrderLine(
            order_id=order_id,
            retailer_id=retailer_id,
            requested_kg=Decimal("40.000"),
            dispatch_status="eligible",
        )
        assert line.shop_name is None
        assert line.items == []

    def test_dispatch_run_summary(self):
        run_id = uuid4()
        summary = DispatchRunSummary(
            id=run_id,
            status="PLANNED",
            driver_name="John Doe",
            planned_kg=Decimal("100.000"),
            actual_loaded_kg=Decimal("95.000"),
        )
        assert summary.id == run_id
        assert summary.status == "PLANNED"
        assert summary.driver_name == "John Doe"
        assert summary.planned_kg == Decimal("100.000")
        assert summary.actual_loaded_kg == Decimal("95.000")

    def test_dispatch_run_summary_defaults(self):
        run_id = uuid4()
        summary = DispatchRunSummary(id=run_id, status="PLANNED")
        assert summary.driver_name is None
        assert summary.planned_kg is None
        assert summary.actual_loaded_kg is None

    def test_dispatch_route_bucket(self):
        bucket = DispatchRouteBucket(
            route_id=None,
            route_name="Unassigned",
            confirmed_kg=Decimal("100.000"),
            assigned_kg=Decimal("50.000"),
            delivered_kg=Decimal("0.000"),
            remaining_unassigned_kg=Decimal("50.000"),
            order_count=5,
            route_status="partial_assigned",
        )
        assert bucket.route_id is None
        assert bucket.route_name == "Unassigned"
        assert bucket.confirmed_kg == Decimal("100.000")
        assert bucket.assigned_kg == Decimal("50.000")
        assert bucket.delivered_kg == Decimal("0.000")
        assert bucket.remaining_unassigned_kg == Decimal("50.000")
        assert bucket.order_count == 5
        assert bucket.route_status == "partial_assigned"
        assert bucket.confirmed_items == []
        assert bucket.unassigned_items == []
        assert bucket.runs == []
        assert bucket.orders == []

    def test_dispatch_today_out(self):
        out = DispatchTodayOut(
            available_stock_kg=Decimal("500.000"),
            total_confirmed_kg=Decimal("200.000"),
            total_remaining_unassigned_kg=Decimal("100.000"),
            routes=[],
        )
        assert out.available_stock_kg == Decimal("500.000")
        assert out.total_confirmed_kg == Decimal("200.000")
        assert out.total_remaining_unassigned_kg == Decimal("100.000")
        assert out.routes == []
        assert out.confirmed_items == []
        assert out.unassigned_items == []
        assert out.available_items == []

    def test_dispatch_today_out_with_items(self):
        item = DispatchItemSummary(
            item_id=uuid4(),
            item_name="Test",
            total_boxes=1,
            total_kg=Decimal("10.000"),
        )
        out = DispatchTodayOut(
            available_stock_kg=Decimal("500.000"),
            total_confirmed_kg=Decimal("200.000"),
            total_remaining_unassigned_kg=Decimal("100.000"),
            confirmed_items=[item],
            unassigned_items=[item],
            available_items=[item],
            routes=[],
        )
        assert len(out.confirmed_items) == 1
        assert len(out.unassigned_items) == 1
        assert len(out.available_items) == 1
