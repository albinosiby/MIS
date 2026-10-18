import { jsonEqual } from "../../../shared/domain/json-equality.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { OperationRecord } from "../../operations/models/index.ts";
import {
  activeStudent,
  operationalDate,
  overlaps,
  unchangedDetails,
} from "../../operations/domain/workflow-context.ts";
export function guardDispatch(
  y: SchoolYearWorkspace,
  row: OperationRecord,
  old?: OperationRecord,
) {
  const rows = y.extensions.filter(
    (r) => r.id !== row.id && r.status !== "cancelled",
  );
  if (
    row.kind === "stops" &&
    row.status === "active" &&
    rows.some(
      (r) =>
        r.kind === "stops" &&
        r.status === "active" &&
        r.values.routeId === row.values.routeId &&
        r.values.sequence === row.values.sequence,
    )
  )
    throw new Error(
      "Active stops on a route must have unique sequence numbers.",
    );
  if (row.kind === "transport-allocations") {
    if (old?.status === "active") unchangedDetails(old, row);
    if (row.status !== "cancelled" && row.status !== "ended") {
      activeStudent(y, row.studentId);
      operationalDate(y, String(row.values.startDate));
      operationalDate(y, String(row.values.endDate));
      if (row.values.startDate > row.values.endDate)
        throw new Error("Allocation dates are reversed.");
      if (
        !rows.some(
          (r) =>
            r.kind === "stops" &&
            r.id === row.values.stopId &&
            r.values.routeId === row.values.routeId &&
            r.status === "active",
        )
      )
        throw new Error("Choose an active stop on this route.");
      if (
        row.status === "active" &&
        rows.some(
          (r) =>
            r.kind === row.kind &&
            r.studentId === row.studentId &&
            r.status === "active" &&
            overlaps(r, row),
        )
      )
        throw new Error(
          "This student already has transport for overlapping dates.",
        );
    }
    if (
      row.status === "ended" &&
      rows.some(
        (r) =>
          r.kind === "boarding" &&
          r.studentId === row.studentId &&
          ["waiting", "boarded"].includes(r.status),
      )
    )
      throw new Error(
        "Clear the student from open trip rosters before ending transport.",
      );
    if (old?.status === "active" && row.status === "cancelled")
      throw new Error(
        "End an active transport allocation instead of cancelling its history.",
      );
  }
  if (row.kind === "trips") {
    if (old?.status === "started") unchangedDetails(old, row);
    if (row.status === "started") {
      const vehicle = rows.find(
        (r) =>
          r.kind === "vehicles" &&
          r.id === row.values.vehicleId &&
          r.status === "active",
      );
      if (!vehicle || String(vehicle.values.insuranceUntil) < row.date)
        throw new Error("Dispatch requires an active insured vehicle.");
      if (
        !rows.some(
          (r) =>
            r.kind === "drivers" &&
            r.staffId === row.staffId &&
            r.values.vehicleId === row.values.vehicleId &&
            r.status === "active" &&
            String(r.values.validUntil) >= row.date,
        )
      )
        throw new Error(
          "Assign a driver with a valid licence to this vehicle before dispatch.",
        );
      if (
        rows.some(
          (r) =>
            r.kind === "trips" &&
            r.status === "started" &&
            (r.staffId === row.staffId ||
              r.values.vehicleId === row.values.vehicleId),
        )
      )
        throw new Error("Vehicle or driver already has an active trip.");
      const roster = rows.filter(
        (r) =>
          r.kind === "transport-allocations" &&
          r.status === "active" &&
          r.values.routeId === row.values.routeId &&
          String(r.values.startDate) <= row.date &&
          String(r.values.endDate) >= row.date,
      );
      if (!roster.length)
        throw new Error(
          "Assign at least one active transport passenger before dispatch.",
        );
      if (roster.length > Number(vehicle.values.capacity))
        throw new Error("Assigned passengers exceed vehicle capacity.");
    }
    if (old?.status === "started" && row.status === "cancelled")
      throw new Error(
        "Complete a dispatched trip after clearing its passengers and incidents.",
      );
    if (row.status === "completed") {
      if (
        rows.some(
          (r) =>
            r.kind === "boarding" &&
            r.values.tripId === row.id &&
            ["waiting", "boarded"].includes(r.status),
        )
      )
        throw new Error(
          "Resolve every waiting passenger and record alighting before completing the trip.",
        );
      if (
        rows.some(
          (r) =>
            r.kind === "transport-alerts" &&
            r.values.tripId === row.id &&
            ["Incident", "SOS"].includes(String(r.values.severity)) &&
            r.status !== "resolved",
        )
      )
        throw new Error("Resolve trip incidents before completion.");
    }
  }
  if (row.kind === "boarding") {
    if (old) unchangedDetails(old, row);
    const trip = rows.find(
      (r) => r.kind === "trips" && r.id === row.values.tripId,
    );
    if (!trip || !["planned", "started"].includes(trip.status))
      throw new Error("The trip is closed or unavailable.");
    if (row.date !== trip.date)
      throw new Error("Boarding date must match the trip.");
    if (
      rows.some(
        (r) =>
          r.kind === "boarding" &&
          r.values.tripId === trip.id &&
          r.studentId === row.studentId,
      )
    )
      throw new Error("Student already has a boarding record for this trip.");
    const allocation = rows.find(
      (r) =>
        r.kind === "transport-allocations" &&
        r.studentId === row.studentId &&
        r.status === "active" &&
        r.values.routeId === trip.values.routeId &&
        r.values.stopId === row.values.stopId &&
        String(r.values.startDate) <= trip.date &&
        String(r.values.endDate) >= trip.date,
    );
    if (!allocation)
      throw new Error(
        "Boarding requires this student's dated route and stop allocation.",
      );
    if (
      ["boarded", "alighted"].includes(row.status) &&
      trip.status !== "started"
    )
      throw new Error("Start the trip before recording boarding or alighting.");
    if (old?.status === "boarded" && row.status === "cancelled")
      throw new Error("Record alighting before closing this passenger.");
  }
  if (
    old &&
    ["vehicles", "drivers"].includes(row.kind) &&
    !jsonEqual(row.values, old.values) &&
    rows.some(
      (r) =>
        r.kind === "trips" &&
        r.status === "started" &&
        (row.kind === "vehicles"
          ? r.values.vehicleId === row.id
          : r.staffId === row.staffId),
    )
  )
    throw new Error(
      "Complete the active trip before changing vehicle or driver details.",
    );
  if (
    ["vehicles", "drivers"].includes(row.kind) &&
    row.status !== "active" &&
    rows.some(
      (r) =>
        r.kind === "trips" &&
        r.status === "started" &&
        (row.kind === "vehicles"
          ? r.values.vehicleId === row.id
          : r.staffId === row.staffId),
    )
  )
    throw new Error(
      "Complete the active trip before taking a vehicle or driver out of service.",
    );
}
